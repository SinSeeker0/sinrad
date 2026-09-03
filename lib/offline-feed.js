"use strict";

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const DAY = 24 * 60 * 60 * 1000;

function defaults(){
  return {
    version:1,
    settings:{retentionDays:30,maxItems:2000},
    sources:[],
    items:[],
    updatedAt:0
  };
}

function cleanText(value, max){
  return String(value == null ? "" : value).replace(/\0/g, "").slice(0, max);
}

function safeInteger(value, fallback, min, max){
  const number = Math.round(Number(value));
  return Number.isFinite(number) ? Math.min(max, Math.max(min, number)) : fallback;
}

function normalizeContentBlocks(input){
  let remaining=250000;
  return (Array.isArray(input)?input:[]).slice(0,300).map(function(raw){
    const block=raw&&typeof raw==="object"?raw:{},type=["paragraph","heading","listItem","quote","code"].includes(block.type)?block.type:"paragraph";
    const runs=(Array.isArray(block.runs)?block.runs:[]).slice(0,80).map(function(rawRun){
      if(remaining<=0)return null;
      const run=rawRun&&typeof rawRun==="object"?rawRun:{},text=cleanText(run.text,Math.min(4000,remaining));remaining-=text.length;
      return text.trim()?{text:text,bold:!!run.bold,italic:!!run.italic,code:!!run.code}:null;
    }).filter(Boolean);
    if(!runs.length)return null;
    return {type:type,level:safeInteger(block.level,1,1,6),ordered:!!block.ordered,index:safeInteger(block.index,1,1,10000),depth:safeInteger(block.depth,0,0,8),runs:runs};
  }).filter(Boolean);
}

function itemMediaRefs(item){
  const refs=[];function add(ref){const value=cleanText(ref,240);if(value&&!refs.includes(value))refs.push(value);}
  (item&&Array.isArray(item.media)?item.media:[]).forEach(add);add(item&&item.authorAvatar);
  (item&&Array.isArray(item.comments)?item.comments:[]).forEach(function(comment){add(comment&&comment.avatar);(comment&&Array.isArray(comment.media)?comment.media:[]).forEach(add);});
  return refs;
}

function normalizeSource(input){
  const source = input && typeof input === "object" ? input : {};
  const platform = cleanText(source.platform, 30).toLowerCase();
  const handle = cleanText(source.handle, 100);
  if(!platform || !handle) throw new Error("Source platform and handle are required");
  return {
    id:cleanText(source.id, 120) || crypto.randomUUID(),
    platform:platform,
    handle:handle,
    label:cleanText(source.label || handle, 140),
    enabled:source.enabled !== false,
    limit:safeInteger(source.limit, 30, 1, 100),
    intervalHours:safeInteger(source.intervalHours, 24, 1, 168),
    sort:["new","hot","top"].includes(source.sort) ? source.sort : "new",
    topComments:safeInteger(source.topComments, 0, 0, 5),
    lastSync:safeInteger(source.lastSync, 0, 0, Number.MAX_SAFE_INTEGER),
    lastError:cleanText(source.lastError, 500),
    createdAt:safeInteger(source.createdAt, Date.now(), 0, Number.MAX_SAFE_INTEGER)
  };
}

function normalizeItem(input){
  const item = input && typeof input === "object" ? input : {};
  const sourceKey = cleanText(item.sourceKey, 200);
  if(!sourceKey) throw new Error("Feed item source key is required");
  return {
    id:cleanText(item.id, 160) || crypto.createHash("sha256").update(sourceKey).digest("hex").slice(0, 32),
    sourceKey:sourceKey,
    sourceId:cleanText(item.sourceId, 120),
    platform:cleanText(item.platform, 30).toLowerCase(),
    community:cleanText(item.community, 120),
    title:cleanText(item.title, 1000),
    author:cleanText(item.author, 200),
    authorFlair:cleanText(item.authorFlair, 300),
    postFlair:cleanText(item.postFlair, 300),
    authorAvatar:cleanText(item.authorAvatar, 240),
    content:cleanText(item.content, 250000),
    contentBlocks:normalizeContentBlocks(item.contentBlocks),
    date:safeInteger(item.date, Date.now(), 0, Number.MAX_SAFE_INTEGER),
    url:cleanText(item.url, 4000),
    downloadedAt:safeInteger(item.downloadedAt, Date.now(), 0, Number.MAX_SAFE_INTEGER),
    updatedAt:safeInteger(item.updatedAt, Date.now(), 0, Number.MAX_SAFE_INTEGER),
    read:!!item.read,
    favorite:!!item.favorite,
    score:safeInteger(item.score, 0, -1000000000, 1000000000),
    commentCount:safeInteger(item.commentCount, 0, 0, 1000000000),
    comments:Array.isArray(item.comments) ? item.comments.slice(0, 80).map(function(comment){
      return {author:cleanText(comment && comment.author, 200),avatar:cleanText(comment && comment.avatar,240),body:cleanText(comment && comment.body, 12000),contentBlocks:normalizeContentBlocks(comment&&comment.contentBlocks),media:Array.isArray(comment&&comment.media)?comment.media.slice(0,4).map(function(ref){return cleanText(ref,240);}).filter(Boolean):[],score:safeInteger(comment && comment.score, 0, -1000000000, 1000000000),depth:safeInteger(comment && comment.depth, 0, 0, 12),date:safeInteger(comment && comment.date, 0, 0, Number.MAX_SAFE_INTEGER)};
    }) : [],
    media:Array.isArray(item.media) ? item.media.slice(0, 20).map(function(ref){return cleanText(ref, 240);}).filter(Boolean) : [],
    mediaUrls:Array.isArray(item.mediaUrls) ? item.mediaUrls.slice(0, 20).map(function(ref){return cleanText(ref, 4000);}).filter(Boolean) : [],
    captureRef:cleanText(item.captureRef, 240),
    captureMime:cleanText(item.captureMime, 100),
    captureSize:safeInteger(item.captureSize, 0, 0, 512 * 1024 * 1024)
  };
}

class OfflineFeedStore {
  constructor(root){
    this.root = path.resolve(root);
    this.mediaRoot = path.join(this.root, "media");
    this.captureRoot = path.join(this.root, "captures");
    this.file = path.join(this.root, "feed.json");
    this.temp = this.file + ".tmp";
    this.data = defaults();
    this.loaded = false;
  }

  load(){
    if(this.loaded) return this.data;
    try{
      const sourceFile=fs.existsSync(this.file)?this.file:(fs.existsSync(this.file+".bak")?this.file+".bak":this.file);
      const parsed = JSON.parse(fs.readFileSync(sourceFile, "utf8"));
      if(parsed && typeof parsed === "object"){
        this.data = defaults();
        this.data.settings = Object.assign(this.data.settings, parsed.settings || {});
        this.data.sources = Array.isArray(parsed.sources) ? parsed.sources.map(normalizeSource) : [];
        this.data.items = Array.isArray(parsed.items) ? parsed.items.map(normalizeItem) : [];
        this.data.updatedAt = safeInteger(parsed.updatedAt, 0, 0, Number.MAX_SAFE_INTEGER);
      }
    }catch(error){
      if(error && error.code !== "ENOENT") console.error("[sinrad] offline feed load failed:", error.message);
    }
    this.loaded = true;
    return this.data;
  }

  save(){
    this.load();
    fs.mkdirSync(this.root, {recursive:true, mode:0o700});
    const payload = JSON.stringify(this.data);
    if(Buffer.byteLength(payload, "utf8") > 80 * 1024 * 1024) throw new Error("Offline feed index is too large");
    fs.writeFileSync(this.temp, payload, {encoding:"utf8", mode:0o600});
    const backup=this.file+".bak";
    try{if(fs.existsSync(backup))fs.unlinkSync(backup);if(fs.existsSync(this.file))fs.renameSync(this.file,backup);fs.renameSync(this.temp,this.file);if(fs.existsSync(backup))fs.unlinkSync(backup);}
    catch(error){if(!fs.existsSync(this.file)&&fs.existsSync(backup))fs.renameSync(backup,this.file);throw error;}
  }

  snapshot(){
    const data = this.load();
    return JSON.parse(JSON.stringify({
      version:data.version,
      settings:data.settings,
      sources:data.sources,
      items:data.items.slice().sort(function(a,b){return b.date-a.date;}),
      updatedAt:data.updatedAt
    }));
  }

  configure(settings){
    const data = this.load();
    data.settings.retentionDays = safeInteger(settings && settings.retentionDays, data.settings.retentionDays, 1, 3650);
    data.settings.maxItems = safeInteger(settings && settings.maxItems, data.settings.maxItems, 100, 20000);
    data.updatedAt = Date.now();
    this.save();
    return this.snapshot();
  }

  addSource(input){
    const data = this.load();
    const source = normalizeSource(input);
    const duplicate = data.sources.find(function(item){return item.platform === source.platform && item.handle.toLowerCase() === source.handle.toLowerCase();});
    if(duplicate) throw new Error("That source is already subscribed");
    data.sources.push(source);
    data.updatedAt = Date.now();
    this.save();
    return source;
  }

  updateSource(id, patch){
    const data = this.load();
    const index = data.sources.findIndex(function(source){return source.id === id;});
    if(index < 0) return null;
    data.sources[index] = normalizeSource(Object.assign({}, data.sources[index], patch || {}, {id:id}));
    data.updatedAt = Date.now();
    this.save();
    return data.sources[index];
  }

  removeSource(id, deleteItems){
    const data = this.load();
    const before = data.sources.length;
    data.sources = data.sources.filter(function(source){return source.id !== id;});
    if(deleteItems) data.items = data.items.filter(function(item){return item.sourceId !== id;});
    if(data.sources.length === before) return false;
    data.updatedAt = Date.now();
    this.save();
    return true;
  }

  mergeItems(sourceId, incoming){
    const data = this.load();
    const byKey = new Map(data.items.map(function(item){return [item.sourceKey, item];}));
    let added = 0, updated = 0;
    (Array.isArray(incoming) ? incoming : []).forEach(function(raw){
      const item = normalizeItem(Object.assign({}, raw, {sourceId:sourceId || raw.sourceId}));
      const prior = byKey.get(item.sourceKey);
      if(prior){
        item.id = prior.id;
        item.read = prior.read;
        item.favorite = prior.favorite;
        item.downloadedAt = prior.downloadedAt;
        if(!item.media.length) item.media = prior.media || [];
        if(!item.authorAvatar) item.authorAvatar = prior.authorAvatar || "";
        if(!item.comments.length) item.comments = prior.comments || [];
        Object.assign(prior, item);
        updated++;
      }else{
        data.items.push(item);
        byKey.set(item.sourceKey, item);
        added++;
      }
    });
    data.updatedAt = Date.now();
    this._applyItemLimit();
    this.save();
    return {added:added, updated:updated, total:data.items.length};
  }

  addCapture(input){
    const raw=input&&typeof input==="object"?input:{};
    const captureRef=cleanText(raw.captureRef,240);
    if(!this.resolveCapture(captureRef)) throw new Error("Saved page reference is invalid");
    const url=cleanText(raw.url,4000),data=this.load();
    const prior=url?data.items.find(function(item){return !!item.captureRef&&item.url===url;}):null;
    const priorCaptureRef=prior&&prior.captureRef,priorMedia=itemMediaRefs(prior);
    const key=prior?prior.sourceKey:(cleanText(raw.sourceKey,200)||("capture:"+captureRef));
    const suppliedMedia=Array.isArray(raw.media)?raw.media.filter(Boolean):[];
    const result=this.mergeItems("",[{
      sourceKey:key,
      platform:cleanText(raw.platform,30)||"web",community:cleanText(raw.community,120)||"Saved page",title:cleanText(raw.title||raw.url||"Saved page",1000),
      author:cleanText(raw.author,200),authorFlair:cleanText(raw.authorFlair,300),postFlair:cleanText(raw.postFlair,300),authorAvatar:cleanText(raw.authorAvatar,240),content:cleanText(raw.content,250000),contentBlocks:normalizeContentBlocks(raw.contentBlocks),date:safeInteger(raw.date,Date.now(),0,Number.MAX_SAFE_INTEGER),
      url:cleanText(raw.url,4000),downloadedAt:Date.now(),updatedAt:Date.now(),
      score:safeInteger(raw.score,0,-1000000000,1000000000),commentCount:safeInteger(raw.commentCount,0,0,1000000000),
      comments:Array.isArray(raw.comments)?raw.comments:[],media:suppliedMedia,mediaUrls:Array.isArray(raw.mediaUrls)?raw.mediaUrls:[],
      captureRef:captureRef,captureMime:cleanText(raw.captureMime||"multipart/related",100),
      captureSize:safeInteger(raw.captureSize,0,0,512*1024*1024)
    }]);
    const current=this.load().items.find(function(item){return item.sourceKey===key;});
    if(priorCaptureRef&&priorCaptureRef!==captureRef){try{const oldCapture=this.resolveCapture(priorCaptureRef);if(oldCapture&&fs.existsSync(oldCapture))fs.unlinkSync(oldCapture);}catch(_){}}
    if(prior){const currentMedia=new Set(itemMediaRefs(current));priorMedia.forEach((ref)=>{if(currentMedia.has(ref))return;try{const oldMedia=this.resolveMedia(ref);if(oldMedia&&fs.existsSync(oldMedia))fs.unlinkSync(oldMedia);}catch(_){}});}
    return result;
  }

  updateItem(id, patch){
    const item = this.load().items.find(function(entry){return entry.id === id;});
    if(!item) return null;
    if(patch && Object.prototype.hasOwnProperty.call(patch, "read")) item.read = !!patch.read;
    if(patch && Object.prototype.hasOwnProperty.call(patch, "favorite")) item.favorite = !!patch.favorite;
    item.updatedAt = Date.now();
    this.data.updatedAt = Date.now();
    this.save();
    return item;
  }

  _applyItemLimit(){
    const max = safeInteger(this.data.settings.maxItems, 2000, 100, 20000);
    const prior = this.data.items.slice();
    const favorites = this.data.items.filter(function(item){return item.favorite;});
    const regular = this.data.items.filter(function(item){return !item.favorite;}).sort(function(a,b){return b.date-a.date;});
    this.data.items = favorites.concat(regular.slice(0, Math.max(0, max-favorites.length)));
    const kept=new Set(this.data.items.map(function(item){return item.id;}));
    prior.forEach((item)=>{if(kept.has(item.id))return;itemMediaRefs(item).forEach((ref)=>{try{const target=this.resolveMedia(ref);if(target&&fs.existsSync(target))fs.unlinkSync(target);}catch(_){}});if(item.captureRef){try{const target=this.resolveCapture(item.captureRef);if(target&&fs.existsSync(target))fs.unlinkSync(target);}catch(_){}}});
  }

  prune(now){
    const data = this.load();
    const cutoff = (now || Date.now()) - safeInteger(data.settings.retentionDays, 30, 1, 3650) * DAY;
    const removed = [],removedCaptures=[];
    data.items = data.items.filter(function(item){
      const keep = item.favorite || item.date >= cutoff;
      if(!keep){removed.push.apply(removed,itemMediaRefs(item));if(item.captureRef)removedCaptures.push(item.captureRef);}
      return keep;
    });
    this._applyItemLimit();
    removed.forEach((ref)=>{ try{ const target=this.resolveMedia(ref); if(target && fs.existsSync(target)) fs.unlinkSync(target); }catch(_){} });
    removedCaptures.forEach((ref)=>{ try{ const target=this.resolveCapture(ref); if(target && fs.existsSync(target)) fs.unlinkSync(target); }catch(_){} });
    data.updatedAt = Date.now();
    this.save();
    return {removed:removed.length, total:data.items.length};
  }

  async writeMedia(sourceKey, index, bytes, extension){
    const buffer = Buffer.from(bytes || []);
    const requested=String(extension||"").toLowerCase(),video=[".mp4",".webm"].includes(requested),maximum=video?96*1024*1024:12*1024*1024;
    if(!buffer.length || buffer.length > maximum) throw new Error("Offline media is too large");
    const ext = [".jpg",".jpeg",".png",".webp",".gif",".mp4",".webm"].includes(requested) ? requested : ".img";
    const postFolder=crypto.createHash("sha256").update(String(sourceKey||"post")).digest("hex").slice(0,24);
    const name = crypto.createHash("sha256").update(sourceKey+":"+index).digest("hex") + ext;
    const folder=path.join(this.mediaRoot,postFolder);
    await fs.promises.mkdir(folder, {recursive:true, mode:0o700});
    await fs.promises.writeFile(path.join(folder, name), buffer, {mode:0o600});
    return "media/" + postFolder + "/" + name;
  }

  resolveMedia(ref){
    const value = String(ref || "").replace(/\\/g, "/");
    if(!/^media\/(?:[a-f0-9]{24}\/)?[a-f0-9]{64}\.(?:jpg|jpeg|png|webp|gif|mp4|webm|img)$/.test(value)) return "";
    const target = path.resolve(this.root, value);
    return target.startsWith(this.mediaRoot + path.sep) ? target : "";
  }

  resolveCapture(ref){
    const value=String(ref||"").replace(/\\/g,"/");
    if(!/^captures\/(?:[a-f0-9]{24}\/)?[a-f0-9]{64}\.mhtml$/.test(value))return "";
    const target=path.resolve(this.root,value);
    return target.startsWith(this.captureRoot+path.sep)?target:"";
  }

  async readMedia(ref){
    const target = this.resolveMedia(ref);
    if(!target) return null;
    const stat = await fs.promises.stat(target),extension=path.extname(target).toLowerCase(),maximum=[".mp4",".webm"].includes(extension)?96*1024*1024:12*1024*1024;
    if(!stat.isFile() || stat.size > maximum) return null;
    return {bytes:await fs.promises.readFile(target), extension:extension};
  }
}

module.exports = { OfflineFeedStore, normalizeSource, normalizeItem, defaults };
