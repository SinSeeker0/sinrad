"use strict";

const dns=require("node:dns").promises;
const net=require("node:net");
const http=require("node:http");
const https=require("node:https");
const {normalizeHttpUrl}=require("./security.js");

function isPrivateAddress(address){
  address=String(address||"").toLowerCase().split("%")[0];
  if(address.startsWith("::ffff:"))address=address.slice(7);
  if(net.isIP(address)===4){
    const parts=address.split(".").map(Number),a=parts[0],b=parts[1];
    return a===0||a===10||a===127||a>=224||(a===100&&b>=64&&b<=127)||(a===169&&b===254)||(a===172&&b>=16&&b<=31)||(a===192&&b===168)||(a===198&&(b===18||b===19));
  }
  if(net.isIP(address)===6)return address==="::"||address==="::1"||address.startsWith("fc")||address.startsWith("fd")||/^fe[89ab]/.test(address);
  return true;
}

async function publicAddress(hostname){
  const host=String(hostname||"").toLowerCase();
  if(host==="localhost"||host.endsWith(".localhost")||host.endsWith(".local"))throw new Error("local addresses are not checked");
  if(net.isIP(host)){if(isPrivateAddress(host))throw new Error("private addresses are not checked");return {address:host,family:net.isIP(host)};}
  const answers=await dns.lookup(host,{all:true,verbatim:true});
  const answer=answers.find(function(item){return !isPrivateAddress(item.address);});
  if(!answer)throw new Error("no public address found");
  return answer;
}

async function requestUrl(raw,redirects){
  const normalized=normalizeHttpUrl(raw);if(!normalized)throw new Error("invalid web address");
  const url=new URL(normalized),resolved=await publicAddress(url.hostname),client=url.protocol==="https:"?https:http;
  return await new Promise(function(resolve,reject){
    const request=client.request({hostname:resolved.address,family:resolved.family,port:url.port||undefined,path:url.pathname+url.search,method:"HEAD",servername:url.protocol==="https:"?url.hostname:undefined,headers:{Host:url.host,"User-Agent":"Sinrad-Link-Checker/1.0","Accept":"*/*"},timeout:7000},function(response){
      const code=Number(response.statusCode)||0,location=response.headers.location;response.resume();
      if(code>=300&&code<400&&location&&redirects<3){let next;try{next=new URL(location,url).toString();}catch(error){reject(error);return;}requestUrl(next,redirects+1).then(resolve,reject);return;}
      resolve({status:(code>=200&&code<400)?"ok":([401,403,405,429].indexOf(code)>=0?"restricted":"broken"),code:code,url:url.toString()});
    });
    request.on("timeout",function(){request.destroy(new Error("timed out"));});
    request.on("error",reject);request.end();
  });
}

async function checkLink(raw){
  try{return await requestUrl(raw,0);}
  catch(error){return {status:/private|local/.test(String(error&&error.message||error))?"blocked":"broken",code:0,error:String(error&&error.message||error)};}
}

module.exports={isPrivateAddress:isPrivateAddress,publicAddress:publicAddress,checkLink:checkLink};
