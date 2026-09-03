"use strict";

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

function clone(value){ return JSON.parse(JSON.stringify(value)); }
function boundedNumber(value, fallback, min, max){ const number=Number(value);return Number.isFinite(number)?Math.min(max,Math.max(min,number)):fallback; }
function cleanText(value, max){ return String(value == null ? "" : value).replace(/\s+/g," ").trim().slice(0,max||500); }
function absoluteFolder(value,fallback){try{const input=String(value||"").trim();if(!input||input.length>2048||!path.isAbsolute(input))return fallback;return path.resolve(input);}catch(_){return fallback;}}
function defaults(downloadFolder){ return {version:2,settings:{notifications:true,defaultIntervalMinutes:1440,retentionDays:90,maxEvents:2000,downloadFolder:downloadFolder||""},monitors:[],events:[],updatedAt:0}; }

function normalizeMonitor(input){
  const now=Date.now(), target=input&&input.target||{};
  return {
    id:cleanText(input&&input.id,100)||crypto.randomUUID(),
    kind:target.kind==="f95"?"f95":"pawchive",
    key:cleanText(target.key,220),
    label:cleanText(input&&input.label||target.label||target.key,180),
    url:cleanText(target.url,2048),
    target:clone(target),
    intervalMinutes:boundedNumber(input&&input.intervalMinutes,1440,15,10080),
    enabled:input&&input.enabled===false?false:true,
    initialized:!!(input&&input.initialized),
    gallerySeeded:!!(input&&input.gallerySeeded),
    lastSeenKey:cleanText(input&&input.lastSeenKey,300),
    lastSeenAt:boundedNumber(input&&input.lastSeenAt,0,0,Number.MAX_SAFE_INTEGER),
    lastChecked:boundedNumber(input&&input.lastChecked,0,0,Number.MAX_SAFE_INTEGER),
    lastError:cleanText(input&&input.lastError,500),
    avatarRef:cleanText(input&&input.avatarRef,240),
    bannerRef:cleanText(input&&input.bannerRef,240),
    createdAt:boundedNumber(input&&input.createdAt,now,0,Number.MAX_SAFE_INTEGER)
  };
}

function normalizeEvent(input){
  const now=Date.now();
  return {
    id:cleanText(input&&input.id,120)||crypto.randomUUID(),monitorId:cleanText(input&&input.monitorId,100),
    key:cleanText(input&&input.key,320),kind:input&&input.kind==="f95"?"f95":"pawchive",
    title:cleanText(input&&input.title||"New update",300),summary:cleanText(input&&input.summary,1000),
    author:cleanText(input&&input.author,180),url:cleanText(input&&input.url,2048),
    date:boundedNumber(input&&input.date,now,0,Number.MAX_SAFE_INTEGER),
    discoveredAt:boundedNumber(input&&input.discoveredAt,now,0,Number.MAX_SAFE_INTEGER),
    read:!!(input&&input.read),mediaRef:cleanText(input&&input.mediaRef,240),
    meta:input&&input.meta&&typeof input.meta==="object"?clone(input.meta):{}
  };
}

class MonitoringStore {
  constructor(root,defaultDownloadFolder){ this.root=path.resolve(root);this.defaultDownloadFolder=absoluteFolder(defaultDownloadFolder,path.join(this.root,"downloads"));this.mediaRoot=path.join(this.root,"media");this.file=path.join(this.root,"monitoring.json");this.temp=this.file+".tmp";this.data=defaults(this.defaultDownloadFolder); }
  load(){
    try{
      const parsed=JSON.parse(fs.readFileSync(this.file,"utf8"));
      const base=defaults(this.defaultDownloadFolder), settings=parsed&&parsed.settings||{};
      base.settings={notifications:settings.notifications!==false,defaultIntervalMinutes:boundedNumber(settings.defaultIntervalMinutes,1440,15,10080),retentionDays:boundedNumber(settings.retentionDays,90,1,3650),maxEvents:boundedNumber(settings.maxEvents,2000,100,20000),downloadFolder:absoluteFolder(settings.downloadFolder,this.defaultDownloadFolder)};
      base.monitors=Array.isArray(parsed&&parsed.monitors)?parsed.monitors.map(normalizeMonitor).filter(function(item){return item.key&&item.url;}):[];
      base.events=Array.isArray(parsed&&parsed.events)?parsed.events.map(normalizeEvent).filter(function(item){return item.key&&item.monitorId;}):[];
      base.updatedAt=boundedNumber(parsed&&parsed.updatedAt,0,0,Number.MAX_SAFE_INTEGER);this.data=base;
    }catch(error){ if(error&&error.code!=="ENOENT")console.error("[sinrad] monitoring load failed:",error.message);this.data=defaults(this.defaultDownloadFolder); }
    return this.snapshot();
  }
  save(){
    fs.mkdirSync(this.root,{recursive:true,mode:0o700});
    this.data.updatedAt=Date.now();const payload=JSON.stringify(this.data);
    if(Buffer.byteLength(payload,"utf8")>20*1024*1024)throw new Error("Monitoring history is too large");
    fs.writeFileSync(this.temp,payload,{encoding:"utf8",mode:0o600});fs.renameSync(this.temp,this.file);return this.snapshot();
  }
  snapshot(){ return clone(this.data); }
  add(input){
    const monitor=normalizeMonitor(input);
    if(!monitor.key||!monitor.url)throw new Error("Invalid monitor");
    if(this.data.monitors.some(function(item){return item.key===monitor.key;}))throw new Error("You are already watching this source");
    this.data.monitors.unshift(monitor);this.save();return clone(monitor);
  }
  remove(id){
    const monitor=this.data.monitors.find(function(item){return item.id===id;}),events=this.data.events.filter(function(item){return item.monitorId===id;});
    const before=this.data.monitors.length;this.data.monitors=this.data.monitors.filter(function(item){return item.id!==id;});
    if(before===this.data.monitors.length)return false;
    this.data.events=this.data.events.filter(function(item){return item.monitorId!==id;});
    [monitor&&monitor.avatarRef,monitor&&monitor.bannerRef].concat(events.map(function(item){return item.mediaRef;})).forEach(this._removeMedia.bind(this));
    this.save();return true;
  }
  updateMonitor(id, patch){
    const item=this.data.monitors.find(function(entry){return entry.id===id;});if(!item)return null;
    if(Object.prototype.hasOwnProperty.call(patch||{},"enabled"))item.enabled=!!patch.enabled;
    if(Object.prototype.hasOwnProperty.call(patch||{},"label"))item.label=cleanText(patch.label,180)||item.label;
    if(Object.prototype.hasOwnProperty.call(patch||{},"intervalMinutes"))item.intervalMinutes=boundedNumber(patch.intervalMinutes,item.intervalMinutes,15,10080);
    ["lastSeenKey","lastError"].forEach(function(key){if(Object.prototype.hasOwnProperty.call(patch||{},key))item[key]=cleanText(patch[key],key==="lastError"?500:300);});
    ["lastSeenAt","lastChecked"].forEach(function(key){if(Object.prototype.hasOwnProperty.call(patch||{},key))item[key]=boundedNumber(patch[key],item[key],0,Number.MAX_SAFE_INTEGER);});
    ["avatarRef","bannerRef"].forEach(function(key){if(Object.prototype.hasOwnProperty.call(patch||{},key))item[key]=cleanText(patch[key],240);});
    if(Object.prototype.hasOwnProperty.call(patch||{},"initialized"))item.initialized=!!patch.initialized;
    if(Object.prototype.hasOwnProperty.call(patch||{},"gallerySeeded"))item.gallerySeeded=!!patch.gallerySeeded;
    this.save();return clone(item);
  }
  configure(patch){
    const settings=this.data.settings;
    if(Object.prototype.hasOwnProperty.call(patch||{},"notifications"))settings.notifications=!!patch.notifications;
    if(Object.prototype.hasOwnProperty.call(patch||{},"defaultIntervalMinutes"))settings.defaultIntervalMinutes=boundedNumber(patch.defaultIntervalMinutes,settings.defaultIntervalMinutes,15,10080);
    if(Object.prototype.hasOwnProperty.call(patch||{},"retentionDays"))settings.retentionDays=boundedNumber(patch.retentionDays,settings.retentionDays,1,3650);
    if(Object.prototype.hasOwnProperty.call(patch||{},"maxEvents"))settings.maxEvents=boundedNumber(patch.maxEvents,settings.maxEvents,100,20000);
    this.prune(false);this.save();return this.snapshot();
  }
  setDownloadFolder(folder){
    const resolved=absoluteFolder(folder,"");if(!resolved)throw new Error("Choose a valid output folder");this.data.settings.downloadFolder=resolved;this.save();return this.snapshot();
  }
  mergeEvents(monitorId, events){
    const known=new Set(this.data.events.map(function(item){return item.key;}));let added=[];
    (Array.isArray(events)?events:[]).forEach(function(raw){const event=normalizeEvent(Object.assign({},raw,{monitorId:monitorId}));if(!event.key||known.has(event.key))return;known.add(event.key);added.push(event);});
    if(added.length){this.data.events=added.concat(this.data.events).sort(function(a,b){return b.discoveredAt-a.discoveredAt||b.date-a.date;});this.prune(false);this.save();}
    return clone(added);
  }
  updateEvent(id, patch){
    const item=this.data.events.find(function(entry){return entry.id===id;});if(!item)return null;
    if(Object.prototype.hasOwnProperty.call(patch||{},"read"))item.read=!!patch.read;this.save();return clone(item);
  }
  markAllRead(){let changed=false;this.data.events.forEach(function(item){if(!item.read){item.read=true;changed=true;}});if(changed)this.save();return changed;}
  prune(save){
    const cutoff=Date.now()-this.data.settings.retentionDays*86400000,max=this.data.settings.maxEvents;
    const prior=this.data.events.slice();this.data.events=this.data.events.filter(function(item){return !item.read||item.discoveredAt>=cutoff;}).slice(0,max);
    const kept=new Set(this.data.events.map(function(item){return item.id;}));prior.forEach((item)=>{if(!kept.has(item.id))this._removeMedia(item.mediaRef);});
    if(save!==false)this.save();return this.snapshot();
  }
  async writeMedia(cacheKey,index,bytes,extension){
    const buffer=Buffer.from(bytes||[]);if(!buffer.length||buffer.length>8*1024*1024)throw new Error("Monitoring image is too large");
    const ext=[".jpg",".jpeg",".png",".webp",".gif"].includes(String(extension||"").toLowerCase())?String(extension).toLowerCase():".img";
    const name=crypto.createHash("sha256").update(String(cacheKey)+":"+String(index)).digest("hex")+ext;
    await fs.promises.mkdir(this.mediaRoot,{recursive:true,mode:0o700});await fs.promises.writeFile(path.join(this.mediaRoot,name),buffer,{mode:0o600});return "media/"+name;
  }
  resolveMedia(ref){
    const value=String(ref||"").replace(/\\/g,"/");if(!/^media\/[a-f0-9]{64}\.(?:jpg|jpeg|png|webp|gif|img)$/.test(value))return "";
    const target=path.resolve(this.root,value);return target.startsWith(this.mediaRoot+path.sep)?target:"";
  }
  async readMedia(ref){
    const target=this.resolveMedia(ref);if(!target)return null;const stat=await fs.promises.stat(target);if(!stat.isFile()||stat.size>8*1024*1024)return null;
    return {bytes:await fs.promises.readFile(target),extension:path.extname(target).toLowerCase()};
  }
  _removeMedia(ref){try{const target=this.resolveMedia(ref);if(target&&fs.existsSync(target))fs.unlinkSync(target);}catch(_){} }
}

module.exports={MonitoringStore,normalizeMonitor,normalizeEvent,defaults};
