"use strict";

const http=require("node:http");
const https=require("node:https");
const {normalizeHttpUrl}=require("./security.js");
const {publicAddress}=require("./link-health.js");

const HTML_LIMIT=1024*1024;
const IMAGE_LIMIT=8*1024*1024;
const REDIRECT_LIMIT=3;

function decodeEntities(value){
  return String(value||"")
    .replace(/&amp;/gi,"&")
    .replace(/&quot;/gi,'"')
    .replace(/&#39;|&apos;/gi,"'")
    .replace(/&lt;/gi,"<")
    .replace(/&gt;/gi,">")
    .replace(/&#(\d+);/g,function(_,n){const code=Number(n);return code>0&&code<=0x10ffff?String.fromCodePoint(code):_;})
    .replace(/&#x([0-9a-f]+);/gi,function(_,n){const code=parseInt(n,16);return code>0&&code<=0x10ffff?String.fromCodePoint(code):_;});
}

function tagAttributes(tag){
  const attrs={};
  String(tag||"").replace(/([^\s=<>]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+))/g,function(_,name,dq,sq,bare){attrs[String(name).toLowerCase()]=decodeEntities(dq!==undefined?dq:(sq!==undefined?sq:bare));return _;});
  return attrs;
}

function parsePreviewTags(html,baseUrl){
  const result={image:"",icon:""},base=new URL(baseUrl),tags=String(html||"").match(/<(?:meta|link)\b[^>]*>/gi)||[];
  tags.forEach(function(tag){
    const attrs=tagAttributes(tag),property=String(attrs.property||attrs.name||"").toLowerCase(),rel=String(attrs.rel||"").toLowerCase();
    if(!result.image&&(property==="og:image"||property==="og:image:url"||property==="twitter:image"||property==="twitter:image:src"))result.image=attrs.content||"";
    if(!result.icon&&/(^|\s)(?:shortcut\s+)?icon(?:\s|$)/.test(rel))result.icon=attrs.href||"";
  });
  ["image","icon"].forEach(function(key){if(!result[key])return;try{const url=new URL(result[key],base);result[key]=/^https?:$/.test(url.protocol)?url.toString():"";}catch(_){result[key]="";}});
  return result;
}

function youtubeThumbnail(raw){
  const normalized=normalizeHttpUrl(raw);if(!normalized)return "";
  try{
    const url=new URL(normalized),host=url.hostname.toLowerCase().replace(/^www\./,""),parts=url.pathname.split("/").filter(Boolean);let id="";
    if(host==="youtu.be")id=parts[0]||"";
    else if(host==="youtube.com"||host.endsWith(".youtube.com")){
      if(url.pathname==="/watch")id=url.searchParams.get("v")||"";
      else if(["shorts","embed","live"].indexOf(parts[0])>=0)id=parts[1]||"";
    }
    return /^[A-Za-z0-9_-]{6,20}$/.test(id)?"https://i.ytimg.com/vi/"+id+"/hqdefault.jpg":"";
  }catch(_){return "";}
}

function faviconServiceUrl(raw){
  const normalized=normalizeHttpUrl(raw);if(!normalized)return "";
  try{return "https://www.google.com/s2/favicons?domain_url="+encodeURIComponent(new URL(normalized).origin)+"&sz=64";}catch(_){return "";}
}

function imageMime(bytes,header){
  const b=Buffer.isBuffer(bytes)?bytes:Buffer.from(bytes||[]),h=String(header||"").toLowerCase().split(";")[0].trim();
  if(b.length>=8&&b[0]===0x89&&b.slice(1,4).toString("ascii")==="PNG")return "image/png";
  if(b.length>=3&&b[0]===0xff&&b[1]===0xd8&&b[2]===0xff)return "image/jpeg";
  if(b.length>=6&&(b.slice(0,6).toString("ascii")==="GIF87a"||b.slice(0,6).toString("ascii")==="GIF89a"))return "image/gif";
  if(b.length>=12&&b.slice(0,4).toString("ascii")==="RIFF"&&b.slice(8,12).toString("ascii")==="WEBP")return "image/webp";
  if(b.length>=4&&b.slice(0,4).toString("ascii")==="\x00\x00\x01\x00")return "image/x-icon";
  return /^image\/(?:png|jpeg|jpg|gif|webp|x-icon|vnd\.microsoft\.icon)$/.test(h)?h:"";
}

async function requestBuffer(raw,options,redirects){
  options=options||{};redirects=redirects||0;
  const normalized=normalizeHttpUrl(raw);if(!normalized)throw new Error("invalid web address");
  const url=new URL(normalized),resolved=await publicAddress(url.hostname),client=url.protocol==="https:"?https:http,limit=Math.max(1024,Number(options.limit)||IMAGE_LIMIT);
  return await new Promise(function(resolve,reject){
    const req=client.request({hostname:resolved.address,family:resolved.family,port:url.port||undefined,path:url.pathname+url.search,method:"GET",servername:url.protocol==="https:"?url.hostname:undefined,headers:{Host:url.host,"User-Agent":"Sinrad-Preview/1.0","Accept":options.accept||"image/avif,image/webp,image/png,image/jpeg,image/gif,text/html;q=0.8,*/*;q=0.2","Accept-Encoding":"identity"},timeout:9000},function(response){
      const code=Number(response.statusCode)||0,location=response.headers.location;
      if(code>=300&&code<400&&location){response.resume();if(redirects>=REDIRECT_LIMIT){reject(new Error("too many redirects"));return;}let next;try{next=new URL(location,url).toString();}catch(error){reject(error);return;}requestBuffer(next,options,redirects+1).then(resolve,reject);return;}
      if(code<200||code>=300){response.resume();reject(new Error("HTTP "+code));return;}
      const declared=Number(response.headers["content-length"])||0;if(declared>limit){response.resume();reject(new Error("response too large"));return;}
      const chunks=[];let size=0,finished=false;
      response.on("data",function(chunk){if(finished)return;size+=chunk.length;if(size>limit){finished=true;response.destroy(new Error("response too large"));return;}chunks.push(chunk);});
      response.on("end",function(){if(finished)return;finished=true;resolve({bytes:Buffer.concat(chunks),contentType:String(response.headers["content-type"]||""),url:url.toString()});});
      response.on("error",function(error){if(!finished){finished=true;reject(error);}});
    });
    req.on("timeout",function(){req.destroy(new Error("timed out"));});req.on("error",reject);req.end();
  });
}

async function fetchHtml(raw){
  const response=await requestBuffer(raw,{limit:HTML_LIMIT,accept:"text/html,application/xhtml+xml;q=0.9"},0);
  if(!/^(?:text\/html|application\/xhtml\+xml)/i.test(response.contentType))throw new Error("not an HTML page");
  return {html:response.bytes.toString("utf8"),url:response.url};
}

async function fetchImage(raw){
  const response=await requestBuffer(raw,{limit:IMAGE_LIMIT,accept:"image/avif,image/webp,image/png,image/jpeg,image/gif,image/x-icon,*/*;q=0.1"},0),mime=imageMime(response.bytes,response.contentType);
  if(!mime)throw new Error("not a supported image");
  return {bytes:response.bytes,mime:mime,url:response.url};
}

async function fetchSiteImage(raw,mode){
  const normalized=normalizeHttpUrl(raw);if(!normalized)throw new Error("invalid web address");
  mode=mode==="icon"?"icon":"rich";
  const page=new URL(normalized),fallback=new URL("/favicon.ico",page.origin).toString();
  if(mode==="icon"){
    try{const image=await fetchImage(fallback);return Object.assign({kind:"icon"},image);}catch(_){}
    try{const doc=await fetchHtml(normalized),tags=parsePreviewTags(doc.html,doc.url),icon=tags.icon||new URL("/favicon.ico",new URL(doc.url).origin).toString();const image=await fetchImage(icon);return Object.assign({kind:"icon"},image);}catch(_){}
    const service=faviconServiceUrl(normalized);if(!service)throw new Error("site icon unavailable");
    const image=await fetchImage(service);return Object.assign({kind:"icon"},image);
  }
  const youtube=youtubeThumbnail(normalized);
  if(youtube){try{const image=await fetchImage(youtube);return Object.assign({kind:"rich"},image);}catch(_){}}
  let tags={image:"",icon:""},docUrl=normalized;
  try{const doc=await fetchHtml(normalized);docUrl=doc.url;tags=parsePreviewTags(doc.html,doc.url);}catch(_){}
  if(tags.image){try{const image=await fetchImage(tags.image);return Object.assign({kind:"rich"},image);}catch(_){}}
  const icon=tags.icon||new URL("/favicon.ico",new URL(docUrl).origin).toString(),image=await fetchImage(icon);
  return Object.assign({kind:"icon"},image);
}

module.exports={decodeEntities:decodeEntities,parsePreviewTags:parsePreviewTags,youtubeThumbnail:youtubeThumbnail,faviconServiceUrl:faviconServiceUrl,imageMime:imageMime,fetchSiteImage:fetchSiteImage};
