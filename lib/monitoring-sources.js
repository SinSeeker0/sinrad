"use strict";

const { normalizeHttpUrl } = require("./security.js");

function text(value, max) {
  return String(value == null ? "" : value).replace(/\s+/g, " ").trim().slice(0, max || 500);
}

function decodeEntities(value) {
  return String(value || "")
    .replace(/&#(\d+);/g, function(_all, number){ return String.fromCodePoint(Number(number) || 0); })
    .replace(/&#x([0-9a-f]+);/gi, function(_all, number){ return String.fromCodePoint(parseInt(number, 16) || 0); })
    .replace(/&quot;/gi, '"').replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<").replace(/&gt;/gi, ">").replace(/&amp;/gi, "&");
}

function plainHtml(value, max) {
  return text(decodeEntities(String(value || "")
    .replace(/<script\b[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")), max || 500);
}

function plainRichHtml(value, max) {
  return cleanRichText(decodeEntities(String(value || "")
    .replace(/<script\b[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[\s\S]*?<\/style>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(?:p|div|li|blockquote|h[1-6]|pre)>/gi, "\n")
    .replace(/<li\b[^>]*>/gi, "• ")
    .replace(/<[^>]+>/g, " ")), max || 250000);
}

function cleanRichText(value, max) {
  return String(value || "").replace(/\r/g, "")
    .replace(/[ \t]+\n/g, "\n").replace(/\n[ \t]+/g, "\n")
    .replace(/[ \t]{2,}/g, " ").replace(/\n{3,}/g, "\n\n")
    .trim().slice(0, max || 250000);
}

function parseTarget(input) {
  const normalized = normalizeHttpUrl(String(input || "").trim());
  if (!normalized || normalized.length > 2048) throw new Error("Enter a valid supported URL");
  const url = new URL(normalized);
  const host = url.hostname.toLowerCase().replace(/^www\./, "");
  const parts = url.pathname.split("/").filter(Boolean);

  if (host === "pawchive.pw" && parts.length >= 3 && parts[1] === "user") {
    const service = parts[0].toLowerCase(), creatorId = parts[2];
    if (!/^[a-z0-9_-]{1,40}$/.test(service) || !/^[a-z0-9_-]{1,100}$/i.test(creatorId)) throw new Error("That Pawchive creator link is invalid");
    return {
      kind:"pawchive", service:service, creatorId:creatorId, displayHost:"pawchive",
      key:"pawchive:" + service + ":" + creatorId,
      url:"https://pawchive.pw/" + encodeURIComponent(service) + "/user/" + encodeURIComponent(creatorId)
    };
  }

  if (host === "bakemono.app" && parts.length >= 3 && parts[0] === "c") {
    const service = parts[1].toLowerCase(), creatorId = parts[2];
    if (!/^[a-z0-9_-]{1,40}$/.test(service) || !/^[a-z0-9_-]{1,100}$/i.test(creatorId)) throw new Error("That Bakemono creator link is invalid");
    return {
      kind:"pawchive", service:service, creatorId:creatorId, displayHost:"bakemono",
      key:"pawchive:" + service + ":" + creatorId,
      url:"https://bakemono.app/c/" + encodeURIComponent(service) + "/" + encodeURIComponent(creatorId)
    };
  }

  if (host === "f95zone.to") {
    const match = url.pathname.match(/^\/threads\/([^/?#]*?\.)?(\d+)(?:\/page-\d+)?\/?$/i);
    if (!match) throw new Error("Use the main link for an F95zone thread");
    const threadId = match[2], basePath = url.pathname.replace(/\/page-\d+\/?$/i, "").replace(/\/$/, "");
    const slug = (match[1] || "").replace(/\.$/, "").replace(/[-_]+/g, " ").trim();
    return {
      kind:"f95", threadId:threadId, key:"f95:" + threadId,
      label:text(slug || ("F95zone thread " + threadId), 160),
      url:"https://f95zone.to" + basePath
    };
  }

  throw new Error("Monitoring currently supports Pawchive, Bakemono and F95zone thread links");
}

function timestamp(value, fallback) {
  const parsed = Date.parse(String(value || ""));
  return Number.isFinite(parsed) ? parsed : (fallback || Date.now());
}

function pawchivePostUrl(target, postId) {
  const service = encodeURIComponent(target.service), creator = encodeURIComponent(target.creatorId), post = encodeURIComponent(String(postId));
  if (target.displayHost === "bakemono") return "https://bakemono.app/p/" + service + "/" + creator + "/" + post;
  return "https://pawchive.pw/" + service + "/user/" + creator + "/post/" + post;
}

function pawchiveThumbnailUrl(file) {
  const source=file&&typeof file==="object"?file:{},value=String(source.path||"").replace(/\\/g,"/");
  if(!/^\/[a-f0-9]{2}\/[a-f0-9]{2}\/[a-f0-9]{32,128}\.(?:jpe?g|png|webp|gif)$/i.test(value))return "";
  return "https://img.pawchive.pw/thumbnail/data"+value;
}

function pawchiveFilePath(file) {
  const source=file&&typeof file==="object"?file:{},value=String(source.path||file||"").replace(/\\/g,"/");
  if(!/^\/[a-f0-9]{2}\/[a-f0-9]{2}\/[a-f0-9]{32,128}\.[a-z0-9]{1,10}$/i.test(value))return "";
  return value;
}

function pawchiveFileUrl(file) {
  const value=pawchiveFilePath(file);
  return value?"https://file.pawchive.pw/data"+value:"";
}

function pawchiveFileKind(name) {
  const extension=(String(name||"").match(/\.([a-z0-9]{1,10})$/i)||[])[1];
  if(/^(?:jpe?g|png|webp|gif|avif)$/i.test(extension||""))return "image";
  if(/^(?:mp4|webm|mov|m4v)$/i.test(extension||""))return "video";
  if(/^(?:mp3|m4a|aac|ogg|wav|flac)$/i.test(extension||""))return "audio";
  return "file";
}

function parsePawchiveDetail(payload) {
  const post=payload&&typeof payload==="object"?payload:{};
  const candidates=[];
  if(post.file&&typeof post.file==="object")candidates.push(post.file);
  if(Array.isArray(post.attachments))candidates.push.apply(candidates,post.attachments);
  const seen=new Set(),files=[];
  candidates.forEach(function(file,index){
    const filePath=pawchiveFilePath(file);if(!filePath||seen.has(filePath))return;seen.add(filePath);
    const fallback=filePath.split("/").pop()||("attachment-"+(index+1));
    const name=text(file&&file.name||fallback,240).replace(/[<>:"/\\|?*\x00-\x1f]/g,"_")||fallback;
    files.push({name:name,path:filePath,kind:pawchiveFileKind(name||filePath)});
  });
  return {
    id:text(post.id,120),title:text(post.title||"Untitled post",1000),
    author:text(post.author||post.user_name||post.user||"",200),
    content:plainRichHtml(post.content||post.description||"",250000),
    date:timestamp(post.published||post.added||post.edited,Date.now()),
    files:files
  };
}

function parsePawchivePosts(payload, target, now) {
  const source = Array.isArray(payload) ? payload : (payload && (payload.posts || payload.results || payload.data));
  if (!Array.isArray(source)) throw new Error("Pawchive returned an unexpected response");
  return source.map(function(post){
    const id = text(post && post.id, 120);
    if (!id) return null;
    const date = timestamp(post.published || post.added || post.edited, now);
    const attachmentList=Array.isArray(post.attachments)?post.attachments:[],attachments=attachmentList.length;
    const previewFile=pawchiveThumbnailUrl(post.file)?post.file:attachmentList.find(function(file){return !!pawchiveThumbnailUrl(file);});
    const mediaPath=previewFile?pawchiveFilePath(previewFile):"",mediaUrl=previewFile?pawchiveThumbnailUrl(previewFile):"";
    return {
      key:"pawchive:" + target.service + ":" + target.creatorId + ":" + id,
      title:text(post.title || "Untitled post", 300),
      summary:plainHtml(post.content || post.description || "", 500),
      author:text(post.author || post.user_name || "", 160),
      url:pawchivePostUrl(target, id),
      date:date,
      mediaUrl:mediaUrl,
      mediaPath:mediaPath,
      meta:{postId:id,attachments:attachments,service:target.service}
    };
  }).filter(Boolean).sort(function(a,b){ return b.date - a.date || String(b.key).localeCompare(String(a.key)); });
}

function filterPostsByDate(posts, fromDate, toDate) {
  if(!/^\d{4}-\d{2}-\d{2}$/.test(String(fromDate||""))||!/^\d{4}-\d{2}-\d{2}$/.test(String(toDate||"")))throw new Error("Choose both a From and To date");
  const parse=function(value,end){const parts=String(value).split("-").map(Number),date=new Date(parts[0],parts[1]-1,parts[2],end?23:0,end?59:0,end?59:0,end?999:0);if(date.getFullYear()!==parts[0]||date.getMonth()!==parts[1]-1||date.getDate()!==parts[2])throw new Error("Choose a valid date range");return date.getTime();};
  const from=parse(fromDate,false),to=parse(toDate,true);if(from>to)throw new Error("The From date must be before the To date");return (Array.isArray(posts)?posts:[]).filter(function(post){return Number(post&&post.date)>=from&&Number(post&&post.date)<=to;});
}

function f95Title(html, fallback) {
  const og = String(html || "").match(/<meta\b[^>]*property=["']og:title["'][^>]*content=["']([^"']+)["']/i)
    || String(html || "").match(/<meta\b[^>]*content=["']([^"']+)["'][^>]*property=["']og:title["']/i);
  const tag = String(html || "").match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return plainHtml((og && og[1]) || (tag && tag[1]) || fallback || "F95zone thread", 200).replace(/\s*\|\s*F95zone.*$/i, "");
}

function f95LastPage(html, threadId) {
  let max = 1;
  const expression = new RegExp("(?:threads/[^\\\"'<>]*?\\." + String(threadId).replace(/\D/g, "") + ")?/page-(\\d+)", "gi");
  let match;
  while ((match = expression.exec(String(html || "")))) max = Math.max(max, Math.min(100000, Number(match[1]) || 1));
  return max;
}

function parseF95Posts(html, target, pageNumber, now) {
  const body = String(html || "");
  const starts = [];
  const expression = /<article\b([^>]*\bdata-content=["']post-(\d+)["'][^>]*)>/gi;
  let match;
  while ((match = expression.exec(body))) starts.push({index:match.index,end:expression.lastIndex,attrs:match[1],id:match[2]});
  const title = f95Title(body, target.label);
  return starts.map(function(start, index){
    const segment = body.slice(start.end, index + 1 < starts.length ? starts[index + 1].index : Math.min(body.length, start.end + 250000));
    const authorMatch = start.attrs.match(/\bdata-author=["']([^"']*)["']/i);
    const dateMatch = segment.match(/<time\b[^>]*datetime=["']([^"']+)["']/i);
    const messageMatch = segment.match(/<div\b[^>]*class=["'][^"']*\bmessage-body\b[^"']*["'][^>]*>([\s\S]*?)(?:<\/div>\s*<\/div>|<footer\b)/i);
    const date = timestamp(dateMatch && dateMatch[1], now);
    return {
      key:"f95:" + target.threadId + ":" + start.id,
      title:(authorMatch && plainHtml(authorMatch[1], 100) ? plainHtml(authorMatch[1], 100) + " replied" : "New thread reply"),
      summary:plainHtml((messageMatch && messageMatch[1]) || "", 500),
      author:plainHtml(authorMatch && authorMatch[1], 100),
      url:target.url + (pageNumber > 1 ? "/page-" + pageNumber : "") + "#post-" + start.id,
      date:date,
      meta:{postId:start.id,page:pageNumber,threadTitle:title}
    };
  }).sort(function(a,b){ return b.date - a.date || Number((b.meta || {}).postId) - Number((a.meta || {}).postId); });
}

module.exports = {
  parseTarget,
  parsePawchivePosts,
  filterPostsByDate,
  parseF95Posts,
  pawchiveThumbnailUrl,
  pawchivePostUrl,
  pawchiveFilePath,
  pawchiveFileUrl,
  parsePawchiveDetail,
  f95LastPage,
  f95Title,
  plainHtml
};
