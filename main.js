// Sinrad — Electron main process (main window + floating desktop "pet" window)
const { app, BrowserWindow, ipcMain, shell, screen, safeStorage, protocol, net, nativeImage, clipboard, dialog } = require("electron");
const path = require("path");
const { pathToFileURL } = require("url");
app.commandLine.appendSwitch("autoplay-policy","no-user-gesture-required");
const PROTOCOL="sinrad";
const MONITOR_MEDIA_PROTOCOL="sinrad-monitor";
const OFFLINE_MEDIA_PROTOCOL="sinrad-offline";
protocol.registerSchemesAsPrivileged([{scheme:MONITOR_MEDIA_PROTOCOL,privileges:{standard:true,secure:true,supportFetchAPI:true,corsEnabled:true}},{scheme:OFFLINE_MEDIA_PROTOCOL,privileges:{standard:true,secure:true,supportFetchAPI:true,corsEnabled:true,stream:true}}]);
if(!app.isPackaged) app.setPath("userData",path.join(app.getPath("appData"),"Sinrad-Dev"));
else app.setAsDefaultProtocolClient(PROTOCOL);
// Keep the packaged identity stable so Windows preserves installed shortcuts
// and pinned taskbar entries across updates. Development uses a separate ID.
const PACKAGED_APP_ID="com.sinrad.desktop";
const APP_ID=app.isPackaged?PACKAGED_APP_ID:PACKAGED_APP_ID+".dev";
app.setAppUserModelId(APP_ID);
const fs = require("fs");
const crypto = require("crypto");
const WINDOW_ICON = app.isPackaged
  ? path.join(process.resourcesPath, process.platform === "win32" ? "icon.ico" : "icon.png")
  : path.join(__dirname, process.platform === "win32" ? "icon.ico" : "icon.png");
const scanFolders = require("./scan.js");
const { normalizeHttpUrl, isPathInside } = require("./lib/security.js");
const { validDirectories, listScreenshotFiles } = require("./lib/screenshots.js");
const { thumbnailKey, pruneThumbnailCache } = require("./lib/thumbnail-cache.js");
const { checkLink } = require("./lib/link-health.js");
const SitePreview = require("./lib/site-preview.js");
const { OfflineFeedStore } = require("./lib/offline-feed.js");
const RedditSource = require("./lib/reddit-source.js");
const { MonitoringStore } = require("./lib/monitoring-store.js");
const MonitoringSources = require("./lib/monitoring-sources.js");
let autoUpdater=null; try{ autoUpdater=require("electron-updater").autoUpdater; }catch(_e){ try{ console.error("[sinrad] electron-updater unavailable:", _e&&_e.message); }catch(_){} }

const DATA_DIR = app.getPath("userData");
const DATA_FILE = path.join(DATA_DIR,"sinrad-data.json");
const DATA_BACKUP = DATA_FILE+".bak";
const DATA_TMP = DATA_FILE+".sinrad-tmp";
const EXTENSION_SOURCE = path.join(__dirname,"extension").replace("app.asar","app.asar.unpacked");
const EXTENSION_DIR = path.join(DATA_DIR,"browser-extension");
const EXTENSION_KEY_FILE = path.join(DATA_DIR,"extension-bridge-key");
const THUMBNAIL_DIR = path.join(DATA_DIR,"thumbnail-cache");
const SITE_PREVIEW_DIR = path.join(DATA_DIR,"site-preview-cache");
const LEGACY_OFFLINE_DIR = path.join(DATA_DIR,"offline-feed");
const DEFAULT_OFFLINE_DIR = app.isPackaged ? path.join(app.getPath("documents"),"Sinrad Offline") : LEGACY_OFFLINE_DIR;
const OFFLINE_LOCATION_FILE = path.join(DATA_DIR,"offline-location.json");
const OFFLINE_AUTH_FILE = path.join(DATA_DIR,"offline-reddit-auth.json");
function _prepareOfflineRoot(root){const resolved=path.resolve(root);fs.mkdirSync(resolved,{recursive:true,mode:0o700});fs.mkdirSync(path.join(resolved,"media"),{recursive:true,mode:0o700});fs.mkdirSync(path.join(resolved,"captures"),{recursive:true,mode:0o700});return resolved;}
function _initialOfflineRoot(){
  let chosen="";try{const saved=JSON.parse(fs.readFileSync(OFFLINE_LOCATION_FILE,"utf8"));if(saved&&typeof saved.path==="string"&&path.isAbsolute(saved.path))chosen=saved.path;}catch(_){}
  if(!chosen)chosen=DEFAULT_OFFLINE_DIR;
  try{
    const resolved=path.resolve(chosen);
    if(resolved!==path.resolve(LEGACY_OFFLINE_DIR)&&!fs.existsSync(path.join(resolved,"feed.json"))&&fs.existsSync(path.join(LEGACY_OFFLINE_DIR,"feed.json"))){fs.mkdirSync(resolved,{recursive:true,mode:0o700});fs.cpSync(LEGACY_OFFLINE_DIR,resolved,{recursive:true,force:false,errorOnExist:false});}
    return _prepareOfflineRoot(resolved);
  }catch(_){return _prepareOfflineRoot(LEGACY_OFFLINE_DIR);}
}
let offlineFeed = new OfflineFeedStore(_initialOfflineRoot());
try{if(!fs.existsSync(OFFLINE_AUTH_FILE)){const oldAuth=[path.join(offlineFeed.root,"reddit-auth.json"),path.join(LEGACY_OFFLINE_DIR,"reddit-auth.json")].find(function(candidate){return fs.existsSync(candidate);});if(oldAuth)fs.copyFileSync(oldAuth,OFFLINE_AUTH_FILE,fs.constants.COPYFILE_EXCL);}}catch(_){}
const MONITORING_DIR = path.join(DATA_DIR,"monitoring");
const ANIMATION_DIR = path.join(DATA_DIR,"animations");
const monitoringStore = new MonitoringStore(MONITORING_DIR,app.getPath("downloads"));
const THUMBNAIL_LIMITS={maxFiles:1500,maxBytes:256*1024*1024,maxAgeMs:45*24*60*60*1000};
const SITE_PREVIEW_LIMITS={maxFiles:1600,maxBytes:320*1024*1024,maxAgeMs:45*24*60*60*1000};
function loadExtensionBridgeKey(){
  try{
    fs.mkdirSync(DATA_DIR,{recursive:true,mode:0o700});
    if(fs.existsSync(EXTENSION_KEY_FILE)){ const key=fs.readFileSync(EXTENSION_KEY_FILE,"utf8").trim(); if(/^[a-f0-9]{64}$/.test(key))return key; }
    const key=crypto.randomBytes(32).toString("hex"); fs.writeFileSync(EXTENSION_KEY_FILE,key,{encoding:"utf8",mode:0o600}); return key;
  }catch(error){ console.error("[sinrad] bridge key failed:",error.message); return crypto.randomBytes(32).toString("hex"); }
}
const EXTENSION_BRIDGE_KEY=loadExtensionBridgeKey();
let _plainStoreWarningShown=false;
let _storeLocked=false;
let _recoveredFromBackup=false;
let _storeCache=null;
let _storeCacheLoaded=false;
let _storeRevision=0;
function _encryptionAvailable(){
  if(!safeStorage.isEncryptionAvailable()) return false;
  return !(process.platform==="linux" && typeof safeStorage.getSelectedStorageBackend==="function" && safeStorage.getSelectedStorageBackend()==="basic_text");
}
function storeSecurity(){ return _encryptionAvailable()?"encrypted":"permissions-only"; }
function _validStore(data){
  if(!data || typeof data!=="object" || Array.isArray(data)) return null;
  ["vault","links","folders","console","petRecents","petPins","shots","shotWatch","scanRoots"].forEach(function(k){ if(data[k]!==undefined && !Array.isArray(data[k])) data[k]=[]; });
  if(data.settings!==undefined && (!data.settings || typeof data.settings!=="object" || Array.isArray(data.settings))) data.settings={};
  return data;
}
function _decodeStore(raw){
  const parsed=JSON.parse(raw);
  if(parsed && parsed.format==="sinrad-encrypted-v1" && typeof parsed.payload==="string"){
    if(!_encryptionAvailable()) throw new Error("OS encryption is currently unavailable");
    return _validStore(JSON.parse(safeStorage.decryptString(Buffer.from(parsed.payload,"base64"))));
  }
  return _validStore(parsed);
}
function _encodeStore(data){
  const json=JSON.stringify(data);
  if(Buffer.byteLength(json,"utf8")>10*1024*1024) throw new Error("store exceeds 10 MB safety limit");
  if(_encryptionAvailable()){
    return JSON.stringify({format:"sinrad-encrypted-v1",payload:safeStorage.encryptString(json).toString("base64")});
  }
  if(!_plainStoreWarningShown){ _plainStoreWarningShown=true; console.warn("[sinrad] OS encryption unavailable; store is protected only by file permissions"); }
  return json;
}
function _readStoreFile(file){ try{ if(fs.existsSync(file)) return _decodeStore(fs.readFileSync(file,"utf8")); }catch(e){ console.error("[sinrad] read store failed:",file,e.message); } return null; }
function readStore(){
  if(_storeCacheLoaded) return _storeCache;
  _storeLocked=false; _recoveredFromBackup=false;
  const primaryExists=fs.existsSync(DATA_FILE);
  const primary=_readStoreFile(DATA_FILE); if(primary){ _storeCache=primary; _storeCacheLoaded=true; _storeRevision++; return primary; }
  const backup=_readStoreFile(DATA_BACKUP);
  if(backup){ _recoveredFromBackup=primaryExists; _storeCache=backup; _storeCacheLoaded=true; _storeRevision++; return backup; }
  if(primaryExists || fs.existsSync(DATA_BACKUP)){ _storeLocked=true; console.error("[sinrad] no readable store copy; writes locked to protect existing data"); }
  _storeCache=null; _storeCacheLoaded=true; _storeRevision++;
  return null;
}
function writeStore(data){
  try{
    if(_storeLocked) return false;
    const clean=_validStore(data); if(!clean) return false;
    fs.mkdirSync(DATA_DIR,{recursive:true,mode:0o700});
    fs.writeFileSync(DATA_TMP,_encodeStore(clean),{encoding:"utf8",mode:0o600});
    try{ fs.chmodSync(DATA_TMP,0o600); }catch(_){}
    if(_recoveredFromBackup && fs.existsSync(DATA_FILE)) fs.renameSync(DATA_FILE,DATA_FILE+".corrupt-"+Date.now());
    else{
      if(fs.existsSync(DATA_BACKUP)) fs.unlinkSync(DATA_BACKUP);
      if(fs.existsSync(DATA_FILE)) fs.renameSync(DATA_FILE,DATA_BACKUP);
    }
    try{ fs.renameSync(DATA_TMP,DATA_FILE); }
    catch(err){ if(fs.existsSync(DATA_BACKUP)&&!fs.existsSync(DATA_FILE)) fs.renameSync(DATA_BACKUP,DATA_FILE); throw err; }
    _storeCache=clean; _storeCacheLoaded=true; _storeRevision++; _recoveredFromBackup=false; return true;
  }catch(e){ try{ if(fs.existsSync(DATA_TMP)) fs.unlinkSync(DATA_TMP); }catch(_){} console.error("[sinrad] write store failed:",e.message); return false; }
}
function migrateLegacyStore(){
  if(fs.existsSync(DATA_FILE)) return;
  const candidates=[path.join(__dirname,"sinrad-data.json"),path.join(__dirname,"sinrad-SANDBOX.json"),path.join(DATA_DIR,"sinrad-SANDBOX.json")];
  for(const file of candidates){ const old=_readStoreFile(file); if(old && writeStore(old)){ console.log("[sinrad] migrated legacy store from",file); return; } }
}

/* ---------- offline feed + Reddit OAuth source ---------- */
const REDDIT_REDIRECT="http://127.0.0.1:47821/reddit/callback";
let _redditAuthCache=undefined;
let _redditPendingAuth=null;
let _redditNextRequestAt=0;
let _offlineSyncPromise=null;
let _monitoringSyncPromise=null;
const _pawchivePreviewCache=new Map();

function _readRedditAuth(){
  if(_redditAuthCache!==undefined) return _redditAuthCache;
  try{
    const box=JSON.parse(fs.readFileSync(OFFLINE_AUTH_FILE,"utf8"));
    let raw="";
    if(box&&box.format==="sinrad-offline-auth-v1"&&box.encrypted&&_encryptionAvailable()) raw=safeStorage.decryptString(Buffer.from(box.payload,"base64"));
    else if(box&&box.format==="sinrad-offline-auth-v1"&&!box.encrypted) raw=Buffer.from(box.payload,"base64").toString("utf8");
    const auth=JSON.parse(raw);
    _redditAuthCache=auth&&auth.clientId&&auth.username?auth:null;
  }catch(_){ _redditAuthCache=null; }
  return _redditAuthCache;
}

function _writeRedditAuth(auth){
  fs.mkdirSync(DATA_DIR,{recursive:true,mode:0o700});
  if(!auth){ try{fs.unlinkSync(OFFLINE_AUTH_FILE);}catch(_){} _redditAuthCache=null; return; }
  const raw=JSON.stringify(auth),encrypted=_encryptionAvailable();
  const payload=encrypted?safeStorage.encryptString(raw).toString("base64"):Buffer.from(raw,"utf8").toString("base64");
  fs.writeFileSync(OFFLINE_AUTH_FILE,JSON.stringify({format:"sinrad-offline-auth-v1",encrypted:encrypted,payload:payload}),{encoding:"utf8",mode:0o600});
  _redditAuthCache=auth;
}

function _redditAuthStatus(){
  const auth=_readRedditAuth();
  return {connected:!!(auth&&auth.refreshToken),username:auth&&auth.username||"",clientId:auth&&auth.clientId||"",secure:_encryptionAvailable()};
}

function _offlineNotify(){
  try{ if(mainWin&&!mainWin.isDestroyed()) mainWin.webContents.send("offline-feed-changed",_offlineState()); }catch(_){}
}
function _offlineState(){const snapshot=offlineFeed.snapshot();snapshot.storagePath=offlineFeed.root;return snapshot;}
async function _switchOfflineRoot(value){
  const target=path.resolve(String(value||"")),current=path.resolve(offlineFeed.root),root=path.parse(target).root;
  if(!value||!path.isAbsolute(String(value))||target===root)throw new Error("Choose a normal folder, not a drive root");
  if(target===current)return _offlineState();
  if(target.startsWith(current+path.sep)||current.startsWith(target+path.sep))throw new Error("Choose a separate folder outside the current offline library");
  if(fs.existsSync(target)&&fs.lstatSync(target).isSymbolicLink())throw new Error("Linked folders cannot be used for offline storage");
  _prepareOfflineRoot(target);
  if(!fs.existsSync(path.join(target,"feed.json"))&&fs.existsSync(path.join(current,"feed.json")))await fs.promises.cp(current,target,{recursive:true,force:false,errorOnExist:false});
  const next=new OfflineFeedStore(target);next.load();next.prune();offlineFeed=next;
  fs.mkdirSync(DATA_DIR,{recursive:true,mode:0o700});fs.writeFileSync(OFFLINE_LOCATION_FILE,JSON.stringify({path:target}),{encoding:"utf8",mode:0o600});
  return _offlineState();
}

function _sleep(ms){return new Promise(function(resolve){setTimeout(resolve,ms);});}
async function _redditThrottle(){const wait=_redditNextRequestAt-Date.now();if(wait>0)await _sleep(Math.min(wait,60000));_redditNextRequestAt=Date.now()+650;}
async function _fetchWithTimeout(url,options,timeoutMs){
  const controller=new AbortController(),timer=setTimeout(function(){controller.abort();},timeoutMs||20000);
  try{return await fetch(url,Object.assign({},options||{},{signal:controller.signal}));}finally{clearTimeout(timer);}
}

async function _redditTokenRequest(auth,fields){
  await _redditThrottle();
  const body=new URLSearchParams(fields);
  const response=await _fetchWithTimeout("https://www.reddit.com/api/v1/access_token",{
    method:"POST",
    headers:{"Authorization":"Basic "+Buffer.from(auth.clientId+":").toString("base64"),"Content-Type":"application/x-www-form-urlencoded","User-Agent":RedditSource.userAgent(auth.username,app.getVersion())},
    body:body.toString()
  },20000);
  const payload=await response.json().catch(function(){return {};});
  if(!response.ok||!payload.access_token)throw new Error(payload.error||("Reddit authentication failed (HTTP "+response.status+")"));
  return payload;
}

async function _redditRefreshToken(auth){
  if(!auth||!auth.refreshToken)throw new Error("Connect Reddit first");
  const token=await _redditTokenRequest(auth,{grant_type:"refresh_token",refresh_token:auth.refreshToken});
  auth.accessToken=token.access_token;
  auth.expiresAt=Date.now()+Math.max(60,Number(token.expires_in)||3600)*1000-60000;
  if(token.refresh_token)auth.refreshToken=token.refresh_token;
  _writeRedditAuth(auth);
  return auth;
}

async function _redditAccessToken(){
  let auth=_readRedditAuth();
  if(!auth||!auth.refreshToken)throw new Error("Connect Reddit first");
  if(!auth.accessToken||Number(auth.expiresAt||0)<=Date.now())auth=await _redditRefreshToken(auth);
  return auth;
}

async function _redditApi(endpoint,retry){
  const auth=await _redditAccessToken();
  await _redditThrottle();
  const response=await _fetchWithTimeout("https://oauth.reddit.com"+endpoint,{
    headers:{"Authorization":"Bearer "+auth.accessToken,"User-Agent":RedditSource.userAgent(auth.username,app.getVersion()),"Accept":"application/json"}
  },25000);
  const reset=Math.max(0,Number(response.headers.get("x-ratelimit-reset"))||0),remaining=Number(response.headers.get("x-ratelimit-remaining"));
  if((response.status===429||remaining===0)&&reset)_redditNextRequestAt=Math.max(_redditNextRequestAt,Date.now()+Math.min(reset*1000,10*60*1000));
  if(response.status===401&&retry!==false){auth.expiresAt=0;_writeRedditAuth(auth);return _redditApi(endpoint,false);}
  if(!response.ok)throw new Error(response.status===429?"Reddit rate limit reached — try again later":"Reddit request failed (HTTP "+response.status+")");
  const length=Number(response.headers.get("content-length")||0);if(length>12*1024*1024)throw new Error("Reddit response was too large");
  return response.json();
}

async function _redditCompleteAuth(code,state){
  const pending=_redditPendingAuth;
  _redditPendingAuth=null;
  if(!pending||!state||state!==pending.state||Date.now()-pending.createdAt>10*60*1000)throw new Error("Reddit connection expired — start it again");
  const auth={clientId:pending.clientId,username:pending.username,refreshToken:"",accessToken:"",expiresAt:0};
  const token=await _redditTokenRequest(auth,{grant_type:"authorization_code",code:String(code||""),redirect_uri:REDDIT_REDIRECT});
  if(!token.refresh_token)throw new Error("Reddit did not return offline access. Reconnect and approve permanent access.");
  auth.refreshToken=token.refresh_token;auth.accessToken=token.access_token;auth.expiresAt=Date.now()+Math.max(60,Number(token.expires_in)||3600)*1000-60000;
  _writeRedditAuth(auth);_offlineNotify();
  return true;
}

function _mimeExtension(type,url){
  const mime=String(type||"").split(";")[0].trim().toLowerCase();
  const map={"image/jpeg":".jpg","image/png":".png","image/webp":".webp","image/gif":".gif","video/mp4":".mp4","video/webm":".webm"};
  if(map[mime])return map[mime];
  try{const ext=path.extname(new URL(url).pathname).toLowerCase();return [".jpg",".jpeg",".png",".webp",".gif",".mp4",".webm"].includes(ext)?ext:"";}catch(_){return "";}
}

function _imageExtension(bytes,type,url){
  const typed=_mimeExtension(type,url);if(typed)return typed;const data=Buffer.from(bytes||[]);
  if(data.length>=8&&data.subarray(0,8).equals(Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a])))return ".png";
  if(data.length>=3&&data[0]===0xff&&data[1]===0xd8&&data[2]===0xff)return ".jpg";
  if(data.length>=6&&(data.subarray(0,6).toString("ascii")==="GIF87a"||data.subarray(0,6).toString("ascii")==="GIF89a"))return ".gif";
  if(data.length>=12&&data.subarray(0,4).toString("ascii")==="RIFF"&&data.subarray(8,12).toString("ascii")==="WEBP")return ".webp";
  return "";
}

async function _cacheRedditMedia(item,maximum){
  const limit=Math.min(20,Math.max(1,Number(maximum)||1)),postUrls=[],tasks=[],byUrl=new Map();
  (item.mediaUrls||[]).forEach(function(value){const safe=RedditSource.redditMediaUrl(value);if(safe&&!postUrls.includes(safe)&&postUrls.length<limit)postUrls.push(safe);});
  function addTask(value,key,assign){const safe=RedditSource.redditMediaUrl(value);if(!safe)return;let task=byUrl.get(safe);if(!task){task={url:safe,key:key,assign:[]};byUrl.set(safe,task);tasks.push(task);}task.assign.push(assign);}
  const postRefs=new Array(postUrls.length);postUrls.forEach(function(url,index){addTask(url,"post-"+index,function(ref){postRefs[index]=ref;});});
  addTask(item.authorAvatarUrl,"author-avatar",function(ref){item.authorAvatar=ref;});
  let commentMediaCount=0;(item.comments||[]).slice(0,80).forEach(function(comment,commentIndex){
    addTask(comment.avatarUrl,"comment-"+commentIndex+"-avatar",function(ref){comment.avatar=ref;});
    const refs=[];(comment.mediaUrls||[]).slice(0,4).forEach(function(url,mediaIndex){if(commentMediaCount>=40)return;commentMediaCount++;addTask(url,"comment-"+commentIndex+"-media-"+mediaIndex,function(ref){refs[mediaIndex]=ref;comment.media=refs.filter(Boolean);});});
  });
  if(!tasks.length)return item;
  async function cacheOne(task){
    try{
      const url=task.url;
      const response=await _fetchWithTimeout(url,{headers:{"Accept":"image/*,video/mp4,video/webm;q=0.9","User-Agent":"Sinrad/"+app.getVersion()+" offline-reader"}},45000);
      const finalUrl=RedditSource.redditMediaUrl(response.url||url);if(!response.ok||!finalUrl)return;
      const contentType=String(response.headers.get("content-type")||"").split(";")[0].toLowerCase(),extension=_mimeExtension(contentType,finalUrl);if(!extension)return;
      if([".mp4",".webm"].includes(extension)?!(contentType.startsWith("video/")||contentType==="application/octet-stream"):!contentType.startsWith("image/"))return;
      const maximumBytes=[".mp4",".webm"].includes(extension)?96*1024*1024:12*1024*1024,length=Number(response.headers.get("content-length")||0);if(length>maximumBytes)return;
      const bytes=await _responseBufferLimited(response,maximumBytes);if(!bytes.length)return;
      const ref=await offlineFeed.writeMedia(item.sourceKey,task.key,bytes,extension);task.assign.forEach(function(assign){assign(ref);});
    }catch(_){}
  }
  for(let index=0;index<tasks.length;index+=6)await Promise.all(tasks.slice(index,index+6).map(cacheOne));
  const cached=postRefs.filter(Boolean);if(cached.length)item.media=cached;
  return item;
}

async function _syncRedditSource(source){
  const subreddit=RedditSource.cleanSubreddit(source.handle),limit=Math.min(100,Math.max(1,Number(source.limit)||30));
  const endpoint="/r/"+encodeURIComponent(subreddit)+"/"+source.sort+"?limit="+limit+"&raw_json=1";
  const payload=await _redditApi(endpoint),now=Date.now();
  const items=RedditSource.parseListing(payload,source,now),known=new Set(offlineFeed.snapshot().items.map(function(item){return item.sourceKey;}));
  for(const item of items){
    if(!known.has(item.sourceKey)&&source.topComments>0){
      try{const id=item.sourceKey.replace(/^reddit:t3_/,"");item.comments=RedditSource.parseComments(await _redditApi("/comments/"+encodeURIComponent(id)+"?limit="+source.topComments+"&depth=1&sort=top&raw_json=1"),source.topComments);}catch(_){}
    }
  }
  const uncached=items.filter(function(item){return !known.has(item.sourceKey)&&item.mediaUrls&&item.mediaUrls.length;});
  for(let index=0;index<uncached.length;index+=3)await Promise.all(uncached.slice(index,index+3).map(_cacheRedditMedia));
  const result=offlineFeed.mergeItems(source.id,items);
  offlineFeed.updateSource(source.id,{lastSync:now,lastError:""});
  return result;
}

async function _refreshOfflineFeed(sourceId,force){
  if(_offlineSyncPromise)return _offlineSyncPromise;
  _offlineSyncPromise=(async function(){
    const snapshot=offlineFeed.snapshot(),now=Date.now();let added=0,updated=0,synced=0,lastError="";
    const sources=snapshot.sources.filter(function(source){return source.enabled&&(!sourceId||source.id===sourceId);});
    for(const source of sources){
      if(!force&&!sourceId&&source.lastSync&&now-source.lastSync<source.intervalHours*60*60*1000)continue;
      try{
        if(source.platform!=="reddit")continue;
        const result=await _syncRedditSource(source);added+=result.added;updated+=result.updated;synced++;
      }catch(error){lastError=String(error&&error.message||error);offlineFeed.updateSource(source.id,{lastError:lastError});}
    }
    offlineFeed.prune();_offlineNotify();return {ok:!lastError||synced>0,added:added,updated:updated,synced:synced,error:lastError};
  })();
  try{return await _offlineSyncPromise;}finally{_offlineSyncPromise=null;}
}

/* ---------- Monitoring Mode sources ---------- */
function _monitoringNotify(){
  try{if(mainWin&&!mainWin.isDestroyed())mainWin.webContents.send("monitoring-changed",monitoringStore.snapshot());}catch(_){}
}

async function _responseTextLimited(response,maxBytes){
  const maximum=Math.max(1024,Number(maxBytes)||6*1024*1024),declared=Number(response.headers.get("content-length")||0);
  if(declared>maximum)throw new Error("The monitoring response was too large");
  if(!response.body||typeof response.body.getReader!=="function"){
    const text=await response.text();if(Buffer.byteLength(text,"utf8")>maximum)throw new Error("The monitoring response was too large");return text;
  }
  const reader=response.body.getReader(),chunks=[];let total=0;
  while(true){const part=await reader.read();if(part.done)break;total+=part.value.byteLength;if(total>maximum){try{await reader.cancel();}catch(_){}throw new Error("The monitoring response was too large");}chunks.push(Buffer.from(part.value));}
  return Buffer.concat(chunks,total).toString("utf8");
}

async function _responseBufferLimited(response,maxBytes){
  const maximum=Math.max(1024,Number(maxBytes)||12*1024*1024),declared=Number(response.headers.get("content-length")||0);if(declared>maximum)throw new Error("The media response was too large");
  if(!response.body||typeof response.body.getReader!=="function"){const buffer=Buffer.from(await response.arrayBuffer());if(buffer.length>maximum)throw new Error("The media response was too large");return buffer;}
  const reader=response.body.getReader(),chunks=[];let total=0;while(true){const part=await reader.read();if(part.done)break;total+=part.value.byteLength;if(total>maximum){try{await reader.cancel();}catch(_){}throw new Error("The media response was too large");}chunks.push(Buffer.from(part.value));}return Buffer.concat(chunks,total);
}

function _monitorHeaders(type){
  if(type==="html")return {"Accept":"text/html,application/xhtml+xml","Accept-Language":"en-US,en;q=0.8","User-Agent":"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/127.0 Safari/537.36"};
  return {"Accept":"application/json","User-Agent":"Sinrad/"+app.getVersion()+" monitoring-mode"};
}

async function _monitorJson(url){
  const response=await _fetchWithTimeout(url,{headers:_monitorHeaders("json"),redirect:"follow"},25000);
  if(!response.ok)throw new Error("Pawchive check failed (HTTP "+response.status+")");
  const finalHost=new URL(response.url||url).hostname.toLowerCase();if(finalHost!=="pawchive.pw")throw new Error("Pawchive redirected somewhere unexpected");
  const raw=await _responseTextLimited(response,8*1024*1024);try{return JSON.parse(raw);}catch(_){throw new Error("Pawchive returned invalid data");}
}

async function _syncPawchiveMonitor(monitor){
  const target=monitor.target,base="https://pawchive.pw/api/v1/"+encodeURIComponent(target.service)+"/user/"+encodeURIComponent(target.creatorId);
  const results=await Promise.allSettled([_monitorJson(base),_monitorJson(base+"/profile")]);
  if(results[0].status!=="fulfilled")throw results[0].reason;
  const profile=results[1].status==="fulfilled"?results[1].value:null;
  const mediaBase="https://pawchive.pw/",service=encodeURIComponent(target.service),creator=encodeURIComponent(target.creatorId);
  return {items:MonitoringSources.parsePawchivePosts(results[0].value,target,Date.now()),label:String(profile&&profile.name||monitor.label||target.key).slice(0,180),avatarUrl:mediaBase+"icons/"+service+"/"+creator,bannerUrl:mediaBase+"banners/"+service+"/"+creator};
}

function _pawchiveMonitorContext(monitorId){
  const monitor=monitoringStore.snapshot().monitors.find(function(item){return item.id===String(monitorId||"");});
  if(!monitor||monitor.kind!=="pawchive")throw new Error("That Pawchive artist is no longer in your Watchlist");
  return monitor;
}

async function _pawchiveAllPosts(monitor){
  const target=monitor.target,base="https://pawchive.pw/api/v1/"+encodeURIComponent(target.service)+"/user/"+encodeURIComponent(target.creatorId),posts=[],seen=new Set();
  for(let page=0;page<200;page+=4){
    const pages=await Promise.all([0,1,2,3].filter(function(step){return page+step<200;}).map(function(step){return _monitorJson(base+"?o="+((page+step)*50));}));
    let complete=false;pages.forEach(function(payload){const batch=MonitoringSources.parsePawchivePosts(payload,target,Date.now());batch.forEach(function(item){if(!seen.has(item.key)){seen.add(item.key);posts.push(item);}});if(batch.length<50)complete=true;});
    if(complete)return posts.sort(function(a,b){return b.date-a.date||String(b.key).localeCompare(String(a.key));});
  }
  throw new Error("This artist has more than 10,000 posts; SINRAD stopped at its safety limit");
}

async function _pawchiveArtistDetail(monitorId){
  const monitor=_pawchiveMonitorContext(monitorId),posts=await _pawchiveAllPosts(monitor),target=monitor.target;
  return {monitorId:monitor.id,label:monitor.label,url:monitor.url,service:target.service,avatarRef:monitor.avatarRef,bannerRef:monitor.bannerRef,intervalMinutes:monitor.intervalMinutes,enabled:monitor.enabled,posts:posts.map(function(item){return {postId:item.meta.postId,title:item.title,summary:item.summary,author:item.author,date:item.date,originalUrl:item.url,attachmentCount:item.meta.attachments||0,previewSrc:item.mediaPath?MONITOR_MEDIA_PROTOCOL+"://thumb"+item.mediaPath:""};})};
}

function _monitoringImageAllowed(value){
  try{
    const url=new URL(String(value||"")),host=url.hostname.toLowerCase();if(url.protocol!=="https:")return false;
    if(host==="pawchive.pw")return /^\/(?:icons|banners)\/[a-z0-9_-]{1,40}\/[a-z0-9_-]{1,100}$/i.test(url.pathname);
    if(host==="img.pawchive.pw")return /^\/thumbnail\/data\/[a-f0-9]{2}\/[a-f0-9]{2}\/[a-f0-9]{32,128}\.(?:jpe?g|png|webp|gif)$/i.test(url.pathname);
  }catch(_){}
  return false;
}

async function _cacheMonitoringImage(url,cacheKey,index){
  if(!_monitoringImageAllowed(url))return "";
  try{
    const response=await _fetchWithTimeout(url,{headers:{"Accept":"image/*","User-Agent":"Sinrad/"+app.getVersion()+" monitoring-mode"},redirect:"follow"},20000);
    if(!response.ok||!_monitoringImageAllowed(response.url||url))return "";
    const length=Number(response.headers.get("content-length")||0);if(length>8*1024*1024)return "";
    const bytes=Buffer.from(await response.arrayBuffer());if(!bytes.length||bytes.length>8*1024*1024)return "";
    const extension=_imageExtension(bytes,response.headers.get("content-type"),response.url||url);if(!extension)return "";
    return await monitoringStore.writeMedia(cacheKey,index,bytes,extension);
  }catch(_){return "";}
}

async function _pawchiveImagePreview(file){
  const url=MonitoringSources.pawchiveThumbnailUrl(file);if(!url)return "";
  if(_pawchivePreviewCache.has(url))return _pawchivePreviewCache.get(url);
  try{
    const response=await _fetchWithTimeout(url,{headers:{"Accept":"image/*","User-Agent":"Sinrad/"+app.getVersion()+" monitoring-reader"},redirect:"follow"},20000);
    if(!response.ok||!_monitoringImageAllowed(response.url||url))return "";
    const length=Number(response.headers.get("content-length")||0);if(length>2*1024*1024)return "";
    const bytes=Buffer.from(await response.arrayBuffer());if(!bytes.length||bytes.length>2*1024*1024)return "";
    const extension=_imageExtension(bytes,response.headers.get("content-type"),response.url||url);if(!extension)return "";
    const mime={".jpg":"image/jpeg",".jpeg":"image/jpeg",".png":"image/png",".webp":"image/webp",".gif":"image/gif"}[extension],preview=mime?"data:"+mime+";base64,"+bytes.toString("base64"):"";
    if(preview){_pawchivePreviewCache.set(url,preview);while(_pawchivePreviewCache.size>160)_pawchivePreviewCache.delete(_pawchivePreviewCache.keys().next().value);}return preview;
  }catch(_){return "";}
}

async function _monitorHtml(url){
  const response=await _fetchWithTimeout(url,{headers:_monitorHeaders("html"),redirect:"follow"},30000);
  if(response.status===403)throw new Error("F95zone blocked the automatic check — open the thread normally and try later");
  if(response.status===429)throw new Error("F95zone rate limit reached — SINRAD will wait before checking again");
  if(!response.ok)throw new Error("F95zone check failed (HTTP "+response.status+")");
  const finalHost=new URL(response.url||url).hostname.toLowerCase().replace(/^www\./,"");if(finalHost!=="f95zone.to")throw new Error("F95zone redirected somewhere unexpected");
  return _responseTextLimited(response,8*1024*1024);
}

async function _syncF95Monitor(monitor){
  const target=monitor.target,first=await _monitorHtml(target.url),lastPage=MonitoringSources.f95LastPage(first,target.threadId);
  const html=lastPage>1?await _monitorHtml(target.url+"/page-"+lastPage):first;
  const items=MonitoringSources.parseF95Posts(html,target,lastPage,Date.now());
  if(!items.length)throw new Error("F95zone did not expose any readable replies; sign-in or anti-bot protection may be required");
  return {items:items,label:MonitoringSources.f95Title(html,monitor.label)};
}

function _showMonitoringNotification(events){
  if(!events.length||!monitoringStore.snapshot().settings.notifications)return;
  try{
    const NotificationClass=require("electron").Notification;if(!NotificationClass.isSupported())return;
    const first=events[0],title=events.length===1?"New monitored update":events.length+" monitored updates";
    const body=events.length===1?first.title:(first.title+" and "+(events.length-1)+" more");
    const notification=new NotificationClass({title:title,body:String(body||"").slice(0,500),silent:true});
    notification.on("click",function(){try{if(mainWin&&!mainWin.isDestroyed()){if(mainWin.isMinimized())mainWin.restore();mainWin.show();mainWin.focus();mainWin.webContents.send("monitoring-open-event",first.id);}}catch(_){}});
    notification.show();
  }catch(error){try{console.error("[sinrad] monitoring notification:",error.message);}catch(_){}}
}

async function _syncOneMonitor(monitor){
  const result=monitor.kind==="f95"?await _syncF95Monitor(monitor):await _syncPawchiveMonitor(monitor);
  const items=result.items||[],newest=items[0],now=Date.now();
  let avatarRef=monitor.avatarRef||"",bannerRef=monitor.bannerRef||"";
  if(monitor.kind==="pawchive"&&(!avatarRef||!bannerRef)){
    const cached=await Promise.all([avatarRef?Promise.resolve(avatarRef):_cacheMonitoringImage(result.avatarUrl,monitor.key,"avatar"),bannerRef?Promise.resolve(bannerRef):_cacheMonitoringImage(result.bannerUrl,monitor.key,"banner")]);
    avatarRef=cached[0]||avatarRef;bannerRef=cached[1]||bannerRef;
  }
  let gallerySeeded=!!monitor.gallerySeeded;
  if(monitor.kind==="pawchive"&&!gallerySeeded&&items.length){
    const history=items.slice(0,24).reverse().map(function(item){return Object.assign({},item,{kind:monitor.kind,discoveredAt:now,read:true,meta:Object.assign({},item.meta||{},{baseline:true})});});
    for(let index=0;index<history.length;index+=3){await Promise.all(history.slice(index,index+3).map(async function(item){if(item.mediaUrl)item.mediaRef=await _cacheMonitoringImage(item.mediaUrl,item.key,"preview");delete item.mediaUrl;}));}
    monitoringStore.mergeEvents(monitor.id,history);gallerySeeded=true;
  }
  const monitorPatch={lastChecked:now,lastError:"",label:result.label||monitor.label,avatarRef:avatarRef,bannerRef:bannerRef,gallerySeeded:gallerySeeded};
  if(!newest){monitoringStore.updateMonitor(monitor.id,monitorPatch);return {added:0,baseline:false};}
  if(!monitor.initialized||!monitor.lastSeenKey){
    monitoringStore.updateMonitor(monitor.id,Object.assign({},monitorPatch,{initialized:true,lastSeenKey:newest.key,lastSeenAt:newest.date}));
    return {added:0,baseline:true};
  }
  const boundary=items.findIndex(function(item){return item.key===monitor.lastSeenKey;});
  const fresh=(boundary>=0?items.slice(0,boundary):items.filter(function(item){return item.date>monitor.lastSeenAt;})).reverse().map(function(item){return Object.assign({},item,{kind:monitor.kind,discoveredAt:now});});
  for(let index=0;index<fresh.length;index+=3){await Promise.all(fresh.slice(index,index+3).map(async function(item){if(item.mediaUrl)item.mediaRef=await _cacheMonitoringImage(item.mediaUrl,item.key,"preview");delete item.mediaUrl;}));}
  monitoringStore.updateMonitor(monitor.id,Object.assign({},monitorPatch,{lastSeenKey:newest.key,lastSeenAt:Math.max(newest.date,monitor.lastSeenAt||0)}));
  const added=monitoringStore.mergeEvents(monitor.id,fresh);_showMonitoringNotification(added);return {added:added.length,baseline:false};
}

async function _refreshMonitoring(monitorId,force){
  if(_monitoringSyncPromise)return _monitoringSyncPromise;
  _monitoringSyncPromise=(async function(){
    const snapshot=monitoringStore.snapshot(),now=Date.now();let checked=0,added=0,baselined=0,lastError="";
    const monitors=snapshot.monitors.filter(function(item){return item.enabled&&(!monitorId||item.id===monitorId);});
    for(const monitor of monitors){
      if(!force&&!monitorId&&monitor.lastChecked&&now-monitor.lastChecked<monitor.intervalMinutes*60000)continue;
      try{const result=await _syncOneMonitor(monitor);checked++;added+=result.added;if(result.baseline)baselined++;}
      catch(error){lastError=String(error&&error.message||error);monitoringStore.updateMonitor(monitor.id,{lastChecked:Date.now(),lastError:lastError});}
    }
    monitoringStore.prune();_monitoringNotify();return {ok:!lastError||checked>0,checked:checked,added:added,baselined:baselined,error:lastError};
  })();
  try{return await _monitoringSyncPromise;}finally{_monitoringSyncPromise=null;}
}

function _pawchiveEventContext(eventId){
  const snapshot=monitoringStore.snapshot(),event=snapshot.events.find(function(item){return item.id===String(eventId||"");});
  const monitor=event&&snapshot.monitors.find(function(item){return item.id===event.monitorId;});
  if(!event||!monitor||event.kind!=="pawchive"||monitor.kind!=="pawchive")throw new Error("That post is no longer available in Monitoring");
  const postId=String(event.meta&&event.meta.postId||"");if(!postId||postId.length>120)throw new Error("That Pawchive post ID is invalid");
  return {event:event,monitor:monitor,postId:postId};
}

async function _pawchivePostDetailForMonitor(monitor,postId,withPreviews){
  const target=monitor.target,id=String(postId||"");if(!id||id.length>120)throw new Error("That Pawchive post ID is invalid");
  const url="https://pawchive.pw/api/v1/"+encodeURIComponent(target.service)+"/user/"+encodeURIComponent(target.creatorId)+"/post/"+encodeURIComponent(id);
  const detail=MonitoringSources.parsePawchiveDetail(await _monitorJson(url));
  detail.monitorId=monitor.id;detail.postId=id;detail.creator=monitor.label;detail.originalUrl=MonitoringSources.pawchivePostUrl(target,id);
  detail.files=await Promise.all(detail.files.map(async function(file){
    const preview=withPreviews!==false&&file.kind==="image"?await _pawchiveImagePreview(file):"";
    return Object.assign({},file,{src:preview||(file.kind==="video"||file.kind==="audio"?MONITOR_MEDIA_PROTOCOL+"://file"+file.path:"")});
  }));
  return detail;
}

async function _pawchivePostDetail(eventId,withPreviews){
  const context=_pawchiveEventContext(eventId),detail=await _pawchivePostDetailForMonitor(context.monitor,context.postId,withPreviews);detail.eventId=context.event.id;detail.originalUrl=context.event.url;return detail;
}

async function _pawchiveArtistPostDetail(monitorId,postId,withPreviews){return _pawchivePostDetailForMonitor(_pawchiveMonitorContext(monitorId),postId,withPreviews);}

function _safeDownloadName(value,index){
  const cleaned=String(value||"").replace(/[<>:"/\\|?*\x00-\x1f]/g,"_").replace(/[. ]+$/g,"").slice(0,180);
  return cleaned||("pawchive-file-"+(index+1));
}

async function _availableDownloadPath(folder,name){
  const extension=path.extname(name),stem=path.basename(name,extension);let target=path.join(folder,name),index=2;
  while(fs.existsSync(target)){target=path.join(folder,stem+" ("+index+")"+extension);index++;}
  return target;
}

async function _writePawchiveDownload(file,destination){
  const remote=MonitoringSources.pawchiveFileUrl(file);if(!remote)throw new Error("That Pawchive file path is invalid");
  const response=await _fetchWithTimeout(remote,{headers:{"Accept":"*/*","User-Agent":"Sinrad/"+app.getVersion()+" monitor-download"},redirect:"follow"},120000);
  if(!response.ok||new URL(response.url||remote).hostname.toLowerCase()!=="file.pawchive.pw")throw new Error("Pawchive download failed (HTTP "+response.status+")");
  const declared=Number(response.headers.get("content-length")||0);if(declared>4*1024*1024*1024)throw new Error("That file is larger than 4 GB");
  const temp=destination+".sinrad-part-"+crypto.randomBytes(6).toString("hex"),stream=fs.createWriteStream(temp,{flags:"wx",mode:0o600});let total=0;
  try{
    const waitDrain=function(){return new Promise(function(resolve,reject){const done=function(){stream.off("error",failed);resolve();},failed=function(error){stream.off("drain",done);reject(error);};stream.once("drain",done);stream.once("error",failed);});};
    const reader=response.body.getReader();while(true){const part=await reader.read();if(part.done)break;total+=part.value.byteLength;if(total>4*1024*1024*1024){try{await reader.cancel();}catch(_){}throw new Error("That file is larger than 4 GB");}if(!stream.write(Buffer.from(part.value)))await waitDrain();}
    await new Promise(function(resolve,reject){stream.end(resolve);stream.once("error",reject);});
    await fs.promises.copyFile(temp,destination);await fs.promises.unlink(temp);return total;
  }catch(error){try{stream.destroy();}catch(_){}try{if(fs.existsSync(temp))fs.unlinkSync(temp);}catch(_){}throw error;}
}

async function _monitoringOutputFolder(){
  const folder=path.resolve(monitoringStore.snapshot().settings.downloadFolder||app.getPath("downloads"));await fs.promises.mkdir(folder,{recursive:true,mode:0o700});return folder;
}

function _postDownloadFolder(root,detail,index,artistName){
  const artist=path.join(root,_safeDownloadName(artistName||detail.creator||"Pawchive artist",0)),stamp=new Date(detail.date||Date.now()).toISOString().slice(0,10);
  return path.join(artist,_safeDownloadName(stamp+" - "+(detail.title||"Untitled post")+" - "+(detail.postId||"post"),index||0));
}

async function _downloadDetailFiles(detail){
  if(!detail.files.length)throw new Error("This post has no downloadable attachments");
  const postFolder=_postDownloadFolder(await _monitoringOutputFolder(),detail,0);await fs.promises.mkdir(postFolder,{recursive:true,mode:0o700});let bytes=0;
  for(let index=0;index<detail.files.length;index++){const file=detail.files[index],target=await _availableDownloadPath(postFolder,_safeDownloadName(file.name,index));bytes+=await _writePawchiveDownload(file,target);}
  return {ok:true,count:detail.files.length,bytes:bytes,folder:postFolder};
}

async function _downloadPawchiveFile(eventId,fileIndex){
  const detail=await _pawchivePostDetail(eventId,false),index=Number(fileIndex),file=detail.files[index];if(!file)throw new Error("That attachment was not found");
  const picked=await dialog.showSaveDialog(mainWin,{title:"Save Pawchive attachment",defaultPath:path.join(await _monitoringOutputFolder(),_safeDownloadName(file.name,index))});if(picked.canceled||!picked.filePath)return {ok:false,canceled:true};
  const bytes=await _writePawchiveDownload(file,picked.filePath);return {ok:true,count:1,bytes:bytes};
}

async function _downloadAllPawchiveFiles(eventId){return _downloadDetailFiles(await _pawchivePostDetail(eventId,false));}

async function _downloadArtistPostFile(monitorId,postId,fileIndex){
  const detail=await _pawchiveArtistPostDetail(monitorId,postId,false),index=Number(fileIndex),file=detail.files[index];if(!file)throw new Error("That attachment was not found");
  const picked=await dialog.showSaveDialog(mainWin,{title:"Save Pawchive attachment",defaultPath:path.join(await _monitoringOutputFolder(),_safeDownloadName(file.name,index))});if(picked.canceled||!picked.filePath)return {ok:false,canceled:true};
  const bytes=await _writePawchiveDownload(file,picked.filePath);return {ok:true,count:1,bytes:bytes};
}

async function _downloadArtistPostFiles(monitorId,postId){return _downloadDetailFiles(await _pawchiveArtistPostDetail(monitorId,postId,false));}

async function _downloadPawchiveArtist(monitorId,fromDate,toDate){
  const monitor=_pawchiveMonitorContext(monitorId),allPosts=await _pawchiveAllPosts(monitor),posts=fromDate||toDate?MonitoringSources.filterPostsByDate(allPosts,fromDate,toDate):allPosts;if(!posts.length)throw new Error("No works were found in that date range");
  const outputRoot=await _monitoringOutputFolder(),artistFolder=path.join(outputRoot,_safeDownloadName(monitor.label||"Pawchive artist",0));await fs.promises.mkdir(artistFolder,{recursive:true,mode:0o700});
  let bytes=0,count=0,postCount=0,failed=0;
  const progress=function(done){try{if(mainWin&&!mainWin.isDestroyed())mainWin.webContents.send("monitoring-download-progress",{monitorId:monitor.id,done:done,total:posts.length,files:count,failed:failed});}catch(_){}};progress(0);
  for(let postIndex=0;postIndex<posts.length;postIndex++){
    const post=posts[postIndex];try{
      const detail=await _pawchivePostDetailForMonitor(monitor,post.meta.postId,false);if(!detail.files.length)continue;
      const postFolder=_postDownloadFolder(outputRoot,detail,postIndex,monitor.label);await fs.promises.mkdir(postFolder,{recursive:true,mode:0o700});
      for(let fileIndex=0;fileIndex<detail.files.length;fileIndex++){const file=detail.files[fileIndex],target=await _availableDownloadPath(postFolder,_safeDownloadName(file.name,fileIndex));bytes+=await _writePawchiveDownload(file,target);count++;}
      postCount++;
    }catch(_){failed++;}if(postIndex%5===0||postIndex===posts.length-1)progress(postIndex+1);
  }
  if(!count&&failed)throw new Error("No files could be downloaded");
  return {ok:true,count:count,postCount:postCount,failed:failed,bytes:bytes,folder:artistFolder};
}

function _openOfflineCapture(ref){
  const target=offlineFeed.resolveCapture(ref);if(!target||!fs.existsSync(target))throw new Error("That saved page file is missing");
  const partition="sinrad-capture-viewer-"+crypto.randomBytes(8).toString("hex"),viewer=new BrowserWindow({parent:mainWin,width:1180,height:820,backgroundColor:"#11110f",autoHideMenuBar:true,title:"Saved page — SINRAD",webPreferences:{partition:partition,contextIsolation:true,nodeIntegration:false,sandbox:true,webSecurity:true,javascript:false}});
  viewer.setMenuBarVisibility(false);viewer.webContents.setWindowOpenHandler(function(){return {action:"deny"};});viewer.webContents.on("will-navigate",function(event){event.preventDefault();});
  viewer.webContents.session.setPermissionRequestHandler(function(_contents,_permission,callback){callback(false);});
  viewer.webContents.session.webRequest.onBeforeRequest({urls:["http://*/*","https://*/*"]},function(_details,callback){callback({cancel:true});});
  viewer.loadURL(pathToFileURL(target).href);return true;
}

function _installMonitorMediaProtocol(){
  protocol.handle(MONITOR_MEDIA_PROTOCOL,async function(request){
    try{
      const parsed=new URL(request.url);if(parsed.hostname!=="file"&&parsed.hostname!=="thumb")return new Response("Not found",{status:404});
      const remote=parsed.hostname==="thumb"?MonitoringSources.pawchiveThumbnailUrl({path:parsed.pathname}):MonitoringSources.pawchiveFileUrl(parsed.pathname);if(!remote)return new Response("Not found",{status:404});
      const headers={"Accept":"*/*","User-Agent":"Sinrad/"+app.getVersion()+" monitor-viewer"},range=request.headers.get("range");if(range)headers.Range=range;
      const response=await net.fetch(remote,{headers:headers,redirect:"error"});return response;
    }catch(_){return new Response("Media unavailable",{status:502});}
  });
}

function _offlineMediaMime(extension){return {".jpg":"image/jpeg",".jpeg":"image/jpeg",".png":"image/png",".webp":"image/webp",".gif":"image/gif",".mp4":"video/mp4",".webm":"video/webm"}[extension]||"application/octet-stream";}
function _installOfflineMediaProtocol(){
  protocol.handle(OFFLINE_MEDIA_PROTOCOL,async function(request){
    try{
      const parsed=new URL(request.url);if(parsed.hostname!=="media")return new Response("Not found",{status:404});
      const name=decodeURIComponent(parsed.pathname).replace(/^\/+/,"");if(!/^(?:[a-f0-9]{24}\/)?[a-f0-9]{64}\.(?:jpg|jpeg|png|webp|gif|mp4|webm)$/i.test(name))return new Response("Not found",{status:404});
      const ref="media/"+name,target=offlineFeed.resolveMedia(ref);if(!target)return new Response("Not found",{status:404});
      const stat=await fs.promises.stat(target),extension=path.extname(target).toLowerCase(),maximum=[".mp4",".webm"].includes(extension)?96*1024*1024:12*1024*1024;if(!stat.isFile()||stat.size<1||stat.size>maximum)return new Response("Not found",{status:404});
      const baseHeaders={"Accept-Ranges":"bytes","Cache-Control":"private, max-age=3600","Content-Type":_offlineMediaMime(extension)};
      if(request.method==="HEAD")return new Response(null,{status:200,headers:Object.assign(baseHeaders,{"Content-Length":String(stat.size)})});
      const range=String(request.headers.get("range")||""),match=/^bytes=(\d*)-(\d*)$/.exec(range);
      if(match){
        let start=match[1]?Number(match[1]):0,end=match[2]?Number(match[2]):stat.size-1;if(!match[1]&&match[2]){const suffix=Math.min(stat.size,Number(match[2])||0);start=stat.size-suffix;end=stat.size-1;}
        if(!Number.isSafeInteger(start)||!Number.isSafeInteger(end)||start<0||end<start||start>=stat.size)return new Response(null,{status:416,headers:Object.assign(baseHeaders,{"Content-Range":"bytes */"+stat.size})});
        end=Math.min(end,stat.size-1);const length=end-start+1,handle=await fs.promises.open(target,"r");try{const buffer=Buffer.alloc(length),read=await handle.read(buffer,0,length,start);return new Response(buffer.subarray(0,read.bytesRead),{status:206,headers:Object.assign(baseHeaders,{"Content-Length":String(read.bytesRead),"Content-Range":"bytes "+start+"-"+(start+read.bytesRead-1)+"/"+stat.size})});}finally{await handle.close();}
      }
      const bytes=await fs.promises.readFile(target);return new Response(bytes,{status:200,headers:Object.assign(baseHeaders,{"Content-Length":String(bytes.length)})});
    }catch(_){return new Response("Media unavailable",{status:502});}
  });
}

function syncBrowserExtension(){
  try{
    fs.mkdirSync(EXTENSION_DIR,{recursive:true,mode:0o700});
    fs.readdirSync(EXTENSION_SOURCE,{withFileTypes:true}).forEach(function(entry){
      if(!entry.isFile()) return;
      const source=path.join(EXTENSION_SOURCE,entry.name);
      const destination=path.join(EXTENSION_DIR,entry.name);
      let incoming=fs.readFileSync(source);
      if(entry.name==="background.js") incoming=Buffer.from(incoming.toString("utf8").replace("__SINRAD_BRIDGE_KEY__",EXTENSION_BRIDGE_KEY),"utf8");
      let current=null; try{ current=fs.readFileSync(destination); }catch(_){}
      if(!current || !current.equals(incoming)) fs.writeFileSync(destination,incoming,{mode:0o600});
    });
  }catch(error){ console.error("[sinrad] extension sync failed:",error.message); }
}

let mainWin = null;
let petWin = null;

function createWindow(){
  mainWin = new BrowserWindow({
    width:1280, height:900, minWidth:900, minHeight:640,
    frame:false, show:false, backgroundColor:"#060608", title:"S.I.R",
    // On Windows, omitting icon makes Chromium use Sinrad.exe's embedded icon.
    icon:process.platform === "win32" ? undefined : WINDOW_ICON,
    webPreferences:{ preload:path.join(__dirname,"preload.js"), contextIsolation:true, nodeIntegration:false, sandbox:true, webSecurity:true }
  });
  if(process.platform === "win32"){
    const exe=app.getPath("exe");
    mainWin.setAppDetails({appId:APP_ID,appIconPath:exe,appIconIndex:0,relaunchCommand:'"'+exe+'"',relaunchDisplayName:"Sinrad"});
  }
  lockNavigation(mainWin,"index.html");
  mainWin.webContents.on("before-input-event",function(event,input){
    if(!_hotkeyCapture&&input&&input.type==="keyDown"&&_inputHotkey(input)===_runtimeHotkeys.commandPalette){
      event.preventDefault();
      try{ mainWin.webContents.send("command-palette"); }catch(_){}
    }
  });
  mainWin.loadFile(path.join(__dirname,"index.html"));
  mainWin.webContents.on("did-start-loading",function(){ _mainRendererReady=false; });
  // Auto-undock pet if setting is enabled; also flush parks queued during boot
  mainWin.webContents.on("did-finish-load", function(){
    _mainRendererReady=true;
    try{
      var st=readStore();
      if(st&&st.settings&&st.settings.petAutoUndock){ showPet(); }
    }catch(e){}
    _flushPendingParks();
    try{ _killBroadcast(); }catch(_){}
  });
  try{ mainWin.webContents.setAudioMuted(true); }catch(e){}   // keep the app silent during the intro video; showMain() un-mutes it
  mainWin.on("focus", function(){ try{ mainWin.webContents.send("app-focus"); }catch(_){} });
  mainWin.on("closed", ()=>{ mainWin=null; if(petWin){ try{petWin.close();}catch(e){} petWin=null; } });
}

/* ---------- floating desktop pet window ---------- */
function createPet(){
  if(petWin) return petWin;
  const wa = screen.getPrimaryDisplay().workArea;
  petWin = new BrowserWindow({
    width:304, height:340, x:wa.x+24, y:wa.y+wa.height-380,
    transparent:true, frame:false, alwaysOnTop:true, resizable:false,
    skipTaskbar:true, hasShadow:false, focusable:true, fullscreenable:false,
    backgroundColor:"#00000000",
    webPreferences:{ preload:path.join(__dirname,"pet-preload.js"), contextIsolation:true, nodeIntegration:false, sandbox:true, webSecurity:true }
  });
  lockNavigation(petWin,"pet.html");
  try{ petWin.setBackgroundColor("#00000000"); }catch(_){}
  petWin.setAlwaysOnTop(true, "screen-saver");           // float above everything
  petWin.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen:true });
  petWin.loadFile(path.join(__dirname,"pet.html"));
  // click-through on transparent areas (forward mouse so renderer can toggle)
  petWin.setIgnoreMouseEvents(true, { forward:true });
  petWin.webContents.on("did-finish-load", function(){ try{ syncPetRecents(); }catch(_){} try{ _killBroadcast(); }catch(_){} });
  petWin.on("closed", ()=>{ petWin=null; });
  return petWin;
}
let petTopTimer=null;
function assertPetTop(){ if(petWin && !petWin.isDestroyed() && petWin.isVisible()){ try{ petWin.setAlwaysOnTop(true,"screen-saver"); petWin.moveTop(); }catch(e){} } }
function showPet(){ const w=createPet(); w.show(); assertPetTop(); if(petTopTimer) clearInterval(petTopTimer); petTopTimer=setInterval(assertPetTop,10000); try{ syncPetRecents(); }catch(_){} }
function hidePet(){ if(petTopTimer){ clearInterval(petTopTimer); petTopTimer=null; } if(petWin) petWin.hide(); }

/* whole-screen dragging: poll the cursor while the user holds the pet */
let dragging=false, dragOff={x:0,y:0}, dragTimer=null;
function startDrag(off){
  dragging=true; dragOff=off||{x:0,y:0};
  if(dragTimer) clearInterval(dragTimer);
  dragTimer=setInterval(()=>{
    if(!dragging||!petWin) return;
    const p=screen.getCursorScreenPoint();
    petWin.setPosition(Math.round(p.x-dragOff.x), Math.round(p.y-dragOff.y));
  },16);
}
function stopDrag(){ dragging=false; if(dragTimer){ clearInterval(dragTimer); dragTimer=null; } }

const BOOT_DIR=path.join(app.getPath("userData"),"boot");
let splashWin=null;
function syncBoot(){ const dest=BOOT_DIR; try{ fs.mkdirSync(dest,{recursive:true}); }catch(e){} const exts=[".mp4",".webm",".mkv",".mov",".ogg",".ogv",".m4v"]; const src=path.join(__dirname,"boot"); try{ fs.readdirSync(src).forEach(function(f){ if(exts.indexOf(path.extname(f).toLowerCase())<0) return; const dp=path.join(dest,f); if(!fs.existsSync(dp)){ try{ fs.writeFileSync(dp, fs.readFileSync(path.join(src,f))); }catch(e){} } }); }catch(e){} }
const ANIMATION_FILES=["norma.gif","checking.gif","updating.gif","complete.gif"];
function syncAnimations(){
  try{
    fs.mkdirSync(ANIMATION_DIR,{recursive:true});
    ANIMATION_FILES.forEach(function(name){const dest=path.join(ANIMATION_DIR,name);if(!fs.existsSync(dest)){try{fs.copyFileSync(path.join(__dirname,name),dest);}catch(_){}}});
    const guide=path.join(ANIMATION_DIR,"README.txt");
    if(!fs.existsSync(guide))fs.writeFileSync(guide,"SINRAD ANIMATIONS\r\n\r\nReplace these files to customize the app. Keep the exact names:\r\n- norma.gif\r\n- checking.gif\r\n- updating.gif\r\n- complete.gif\r\n\r\nChanges appear after restarting SINRAD.\r\n","utf8");
  }catch(_){}
}
function animationAssets(){
  const out={};
  ANIMATION_FILES.forEach(function(name){try{const file=path.join(ANIMATION_DIR,name),stat=fs.statSync(file);if(stat.isFile())out[path.basename(name,".gif")]=pathToFileURL(file).href+"?v="+Math.floor(stat.mtimeMs);}catch(_){}});
  return out;
}
function pickBootVideo(){ try{ if(!fs.existsSync(BOOT_DIR)) return null; const exts=[".mp4",".webm",".mkv",".mov",".ogg",".ogv",".m4v"]; const files=fs.readdirSync(BOOT_DIR).filter(function(f){ return exts.indexOf(path.extname(f).toLowerCase())>=0; }); if(!files.length) return null; return path.join(BOOT_DIR, files[Math.floor(Math.random()*files.length)]); }catch(e){ return null; } }
function lockNavigation(win, file){ const expected=path.resolve(__dirname,file).toLowerCase(); win.webContents.on("will-navigate",function(e,url){ try{ const actual=path.resolve(decodeURIComponent(new URL(url).pathname).replace(/^\/(?:([a-zA-Z]:))/,"$1")).toLowerCase(); if(actual!==expected)e.preventDefault(); }catch(_){e.preventDefault();} }); win.webContents.setWindowOpenHandler(function(){ return {action:"deny"}; }); }
function createSplash(vid){ try{ splashWin=new BrowserWindow({ width:720, height:408, frame:false, transparent:false, alwaysOnTop:true, skipTaskbar:true, resizable:false, show:true, backgroundColor:"#000000", webPreferences:{ preload:path.join(__dirname,"splash-preload.js"), contextIsolation:true, nodeIntegration:false, sandbox:true, webSecurity:true } }); lockNavigation(splashWin,"splash.html"); splashWin.setMenuBarVisibility(false); splashWin.loadFile(path.join(__dirname,"splash.html")); splashWin.webContents.once("did-finish-load",function(){ try{ splashWin.webContents.send("boot-video",vid); }catch(e){} }); splashWin.on("closed",function(){ splashWin=null; finishBoot(); }); try{ splashWin.webContents.on("render-process-gone",function(){ finishBoot(); }); splashWin.webContents.on("crashed",function(){ finishBoot(); }); }catch(e){} }catch(e){ splashWin=null; } }
/* Boot flow: the splash video plays FIRST (to completion or until skipped).
   The main window loads hidden in the background and only appears once the
   video is done, so the user always gets to see the boot video. */
let mainReady=false, bootFinished=false, hasSplash=false;
function showMain(){ if(mainWin && !mainWin.isDestroyed()){ try{ mainWin.webContents.setAudioMuted(false); }catch(e){} try{ if(!mainWin.isMaximized()) mainWin.maximize(); }catch(e){} mainWin.show(); try{ mainWin.focus(); }catch(e){} } }
function finishBoot(){ if(bootFinished) return; bootFinished=true; try{ if(splashWin && !splashWin.isDestroyed()) splashWin.close(); }catch(e){} splashWin=null; if(mainReady) showMain(); }
// --- single instance + protocol URL handling ---
const _gotLock=app.requestSingleInstanceLock();
if(!_gotLock){ app.quit(); }
if(_gotLock) {
  app.on('second-instance', function(ev, argv){
    var url=argv.find(function(a){ return a.startsWith(PROTOCOL+'://'); });
    if(url) _handleProtocolUrl(url);
    if(mainWin && !mainWin.isDestroyed()){ if(mainWin.isMinimized()) mainWin.restore(); mainWin.show(); mainWin.focus(); }
  });
}
let _pendingParks=[];
let _mainRendererReady=false;
const _pendingParkAcks=new Map();
function _sendPark(data){
  try{
    if(_mainRendererReady && mainWin && !mainWin.isDestroyed()){ mainWin.webContents.send('protocol-park', data); return true; }
  }catch(_){}
  _pendingParks.push(data);
  return false;
}
function _flushPendingParks(){
  if(!mainWin || mainWin.isDestroyed() || !_pendingParks.length) return;
  var q=_pendingParks; _pendingParks=[];
  for(var i=0;i<q.length;i++){ try{ mainWin.webContents.send('protocol-park', q[i]); }catch(_){} }
}
function _handleProtocolUrl(url){
  try{
    var u=new URL(url);
    if(u.hostname==='park'||u.pathname==='/park'){
      var linkUrl=normalizeHttpUrl(u.searchParams.get('url')||'');
      var title=String(u.searchParams.get('title')||'').slice(0,500);
      var lot=u.searchParams.get('lot')==='1';
      if(linkUrl) _sendPark({url:linkUrl,title:title,lot:lot});
    }
  }catch(_){}
}
function _sendParkWithAck(data){
  const requestId=crypto.randomBytes(16).toString("hex"); data=Object.assign({},data,{requestId:requestId});
  return new Promise(function(resolve){
    const timer=setTimeout(function(){ _pendingParkAcks.delete(requestId); resolve({ok:false,error:"Sinrad did not confirm the save"}); },15000);
    _pendingParkAcks.set(requestId,function(ok){ clearTimeout(timer); resolve(ok?{ok:true}:{ok:false,error:"Sinrad could not persist the save"}); });
    _sendPark(data);
  });
}
app.on("open-url",function(event,url){ event.preventDefault(); _handleProtocolUrl(url); });

// --- authenticated localhost bridge for the browser extension ---
const LOCAL_PORT = 47821;
const LOCAL_TOKEN = crypto.randomBytes(32).toString("hex");
let _localServer = null;
let _localHits=[];
const CAPTURE_MAX_BYTES=256*1024*1024;
const _captureSessions=new Map();
function _localJson(res,status,data,origin){ if(origin) res.setHeader("Access-Control-Allow-Origin",origin); res.setHeader("Vary","Origin"); res.writeHead(status,{"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store"}); res.end(JSON.stringify(data)); }
function _validBridgeKey(value){ try{ const supplied=Buffer.from(String(value||""),"utf8"), expected=Buffer.from(EXTENSION_BRIDGE_KEY,"utf8"); return supplied.length===expected.length&&crypto.timingSafeEqual(supplied,expected); }catch(_){return false;} }
function _captureRemove(session){if(!session)return;_captureSessions.delete(session.id);try{if(fs.existsSync(session.temp))fs.unlinkSync(session.temp);}catch(_){}}
function _captureCleanup(){const cutoff=Date.now()-15*60*1000;for(const session of _captureSessions.values())if(session.createdAt<cutoff)_captureRemove(session);}
function _captureMetadata(value,pageUrl,fallbackTitle){
  const raw=value&&typeof value==="object"?value:{};
  const text=function(input,maximum){return String(input==null?"":input).replace(/\0/g,"").replace(/\s+/g," ").trim().slice(0,maximum);};
  const inline=function(input,maximum){return String(input==null?"":input).replace(/\0/g,"").replace(/\s+/g," ").slice(0,maximum);};
  const block=function(input,maximum){return String(input==null?"":input).replace(/\0/g,"").replace(/\r/g,"").replace(/[ \t]+/g," ").replace(/ *\n */g,"\n").replace(/\n{3,}/g,"\n\n").trim().slice(0,maximum);};
  let host="";try{host=new URL(pageUrl).hostname.toLowerCase();}catch(_){}
  const reddit=host==="reddit.com"||host.endsWith(".reddit.com")||host==="redd.it"||host.endsWith(".redd.it");
  const mediaUrls=[];(Array.isArray(raw.mediaUrls)?raw.mediaUrls:[]).forEach(function(candidate){const safe=RedditSource.redditMediaUrl(candidate);if(safe&&!mediaUrls.includes(safe)&&mediaUrls.length<20)mediaUrls.push(safe);});
  let community=text(raw.community,120);if(reddit&&!community){try{const match=new URL(pageUrl).pathname.match(/\/r\/([A-Za-z0-9_]{2,21})/i);if(match)community="r/"+match[1];}catch(_){}}
  const number=function(input,fallback,min,max){const parsed=Math.round(Number(input));return Number.isFinite(parsed)?Math.min(max,Math.max(min,parsed)):fallback;};
  const authorFlair=text(raw.authorFlair,300),postFlair=text(raw.postFlair,300);let content=block(raw.content,30000);if(reddit&&((authorFlair&&content.toLowerCase()===authorFlair.toLowerCase())||(postFlair&&content.toLowerCase()===postFlair.toLowerCase())))content="";
  let remaining=250000;const contentBlocks=(Array.isArray(raw.contentBlocks)?raw.contentBlocks:[]).slice(0,300).map(function(rawBlock){const entry=rawBlock&&typeof rawBlock==="object"?rawBlock:{},type=["paragraph","heading","listItem","quote","code"].includes(entry.type)?entry.type:"paragraph",runs=(Array.isArray(entry.runs)?entry.runs:[]).slice(0,80).map(function(rawRun){if(remaining<=0)return null;const run=rawRun&&typeof rawRun==="object"?rawRun:{},value=inline(run.text,Math.min(4000,remaining));remaining-=value.length;return value.trim()?{text:value,bold:!!run.bold,italic:!!run.italic,code:!!run.code}:null;}).filter(Boolean);return runs.length?{type:type,level:number(entry.level,1,1,6),ordered:!!entry.ordered,index:number(entry.index,1,1,10000),depth:number(entry.depth,0,0,8),runs:runs}:null;}).filter(Boolean);
  if(reddit&&postFlair&&contentBlocks.map(function(entry){return entry.runs.map(function(run){return run.text;}).join("");}).join(" ").trim().toLowerCase()===postFlair.toLowerCase())contentBlocks.length=0;
  const commentBlocks=function(input){let available=12000;return (Array.isArray(input)?input:[]).slice(0,80).map(function(rawBlock){const entry=rawBlock&&typeof rawBlock==="object"?rawBlock:{},type=["paragraph","heading","listItem","quote","code"].includes(entry.type)?entry.type:"paragraph",runs=(Array.isArray(entry.runs)?entry.runs:[]).slice(0,40).map(function(rawRun){if(available<=0)return null;const run=rawRun&&typeof rawRun==="object"?rawRun:{},value=inline(run.text,Math.min(2000,available));available-=value.length;return value.trim()?{text:value,bold:!!run.bold,italic:!!run.italic,code:!!run.code}:null;}).filter(Boolean);return runs.length?{type:type,level:number(entry.level,1,1,6),ordered:!!entry.ordered,index:number(entry.index,1,1,10000),depth:number(entry.depth,0,0,8),runs:runs}:null;}).filter(Boolean);};
  return {
    platform:reddit?"reddit":"web",community:community||(reddit?"Reddit":"Saved page"),
    title:text(raw.title,1000)||text(fallbackTitle,1000)||pageUrl,
    author:text(raw.author,200).replace(/^\/?u\//i,""),authorFlair:authorFlair,postFlair:postFlair,authorAvatarUrl:text(raw.authorAvatarUrl,4000),content:content,contentBlocks:contentBlocks,
    date:number(raw.date,Date.now(),0,Number.MAX_SAFE_INTEGER),score:number(raw.score,0,-1000000000,1000000000),
    commentCount:number(raw.commentCount,0,0,1000000000),mediaUrls:mediaUrls,
    comments:(Array.isArray(raw.comments)?raw.comments:[]).slice(0,80).map(function(comment){const entry=comment&&typeof comment==="object"?comment:{},avatarUrl=RedditSource.redditMediaUrl(entry.avatarUrl),mediaUrls=[];(Array.isArray(entry.mediaUrls)?entry.mediaUrls:[]).forEach(function(value){const safe=RedditSource.redditMediaUrl(value);if(safe&&!mediaUrls.includes(safe)&&mediaUrls.length<4)mediaUrls.push(safe);});return {author:text(entry.author,200).replace(/^\/?u\//i,""),avatarUrl:avatarUrl,body:block(entry.body,12000),contentBlocks:commentBlocks(entry.contentBlocks),mediaUrls:mediaUrls,score:number(entry.score,0,-1000000000,1000000000),depth:number(entry.depth,0,0,12),date:number(entry.date,0,0,Number.MAX_SAFE_INTEGER)};}).filter(function(comment){return !!comment.body||comment.mediaUrls.length;})
  };
}
function _captureStart(data){
  _captureCleanup();if(_captureSessions.size>=4)throw new Error("Too many page saves are already running");
  const url=normalizeHttpUrl(data&&data.url),title=String(data&&data.title||"").replace(/\0/g,"").slice(0,1000);
  const size=Math.round(Number(data&&data.size));if(!url)throw new Error("A web page URL is required");if(!Number.isFinite(size)||size<1||size>CAPTURE_MAX_BYTES)throw new Error("Saved page must be under 256 MB");
  fs.mkdirSync(offlineFeed.captureRoot,{recursive:true,mode:0o700});
  const id=crypto.randomBytes(24).toString("hex"),temp=path.join(offlineFeed.captureRoot,id+".part");
  fs.writeFileSync(temp,Buffer.alloc(0),{mode:0o600,flag:"wx"});
  _captureSessions.set(id,{id:id,temp:temp,url:url,title:title||new URL(url).hostname,metadata:_captureMetadata(data&&data.metadata,url,title),size:size,received:0,nextIndex:0,hash:crypto.createHash("sha256"),createdAt:Date.now()});
  return id;
}
function _captureAppend(id,index,bytes){
  const session=_captureSessions.get(String(id||""));if(!session)throw new Error("Saved page session expired");
  if(Number(index)!==session.nextIndex)throw new Error("Saved page chunks arrived out of order");
  const buffer=Buffer.from(bytes||[]);if(!buffer.length||buffer.length>1024*1024)throw new Error("Saved page chunk is invalid");
  if(session.received+buffer.length>session.size||session.received+buffer.length>CAPTURE_MAX_BYTES)throw new Error("Saved page is too large");
  fs.appendFileSync(session.temp,buffer);session.hash.update(buffer);session.received+=buffer.length;session.nextIndex++;session.createdAt=Date.now();return session.received;
}
async function _captureFinish(id){
  const session=_captureSessions.get(String(id||""));if(!session)throw new Error("Saved page session expired");
  if(session.received!==session.size)throw new Error("Saved page upload is incomplete");
  const folder=crypto.createHash("sha256").update(session.url).digest("hex").slice(0,24),name=session.hash.digest("hex")+".mhtml",captureFolder=path.join(offlineFeed.captureRoot,folder);fs.mkdirSync(captureFolder,{recursive:true,mode:0o700});const target=path.join(captureFolder,name),ref="captures/"+folder+"/"+name;
  if(fs.existsSync(target))fs.unlinkSync(session.temp);else fs.renameSync(session.temp,target);
  _captureSessions.delete(session.id);
  const existing=offlineFeed.snapshot().items.find(function(item){return !!item.captureRef&&item.url===session.url;});
  const item=Object.assign({},session.metadata,{sourceKey:existing?existing.sourceKey:("capture:"+ref),captureRef:ref,captureMime:"multipart/related",captureSize:session.received,url:session.url,title:session.metadata.title||session.title});
  await _cacheRedditMedia(item,20);offlineFeed.addCapture(item);_offlineNotify();
  return {ok:true,itemCount:offlineFeed.snapshot().items.length};
}
function _readLocalBody(req,maximum,binary){return new Promise(function(resolve,reject){const chunks=[];let total=0,failed=false;req.on("data",function(chunk){if(failed)return;total+=chunk.length;if(total>maximum){failed=true;reject(new Error("request too large"));return;}chunks.push(Buffer.from(chunk));});req.on("end",function(){if(!failed){const body=Buffer.concat(chunks,total);resolve(binary?body:body.toString("utf8"));}});req.on("error",reject);});}
function _startLocalServer(){
  if(_localServer) return;
  try{
    const http = require('http');
    _localServer = http.createServer(function(req, res){
      const origin=String(req.headers.origin||"");
      if(req.method==="OPTIONS"){ if(origin)res.setHeader("Access-Control-Allow-Origin",origin); res.setHeader("Vary","Origin"); res.setHeader("Access-Control-Allow-Methods","GET,POST,OPTIONS"); res.setHeader("Access-Control-Allow-Headers","Content-Type,X-Sinrad-Token,X-Sinrad-Bridge-Key"); res.writeHead(204); res.end(); return; }
      const u=new URL(req.url,"http://localhost");
      if(req.method==="GET"&&u.pathname==="/reddit/callback"){
        const denied=u.searchParams.get("error"),code=u.searchParams.get("code"),state=u.searchParams.get("state");
        Promise.resolve().then(function(){if(denied)throw new Error("Reddit connection was cancelled");return _redditCompleteAuth(code,state);}).then(function(){
          res.writeHead(200,{"Content-Type":"text/html; charset=utf-8","Cache-Control":"no-store","Content-Security-Policy":"default-src 'none'; style-src 'unsafe-inline'"});
          res.end('<!doctype html><meta charset="utf-8"><title>Reddit connected</title><style>body{background:#080b12;color:#e9edf6;font:16px Segoe UI,sans-serif;display:grid;place-items:center;height:100vh;margin:0}main{padding:32px;border:1px solid #283348;background:#101622}b{color:#ff8b60}</style><main><b>Reddit connected to SINRAD</b><p>You can close this tab and return to Offline Mode.</p></main>');
        }).catch(function(error){
          const message=String(error&&error.message||error).replace(/[&<>"']/g,function(char){return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[char];});
          res.writeHead(400,{"Content-Type":"text/html; charset=utf-8","Cache-Control":"no-store","Content-Security-Policy":"default-src 'none'; style-src 'unsafe-inline'"});
          res.end('<!doctype html><meta charset="utf-8"><title>Connection failed</title><style>body{background:#080b12;color:#e9edf6;font:16px Segoe UI,sans-serif;display:grid;place-items:center;height:100vh;margin:0}main{padding:32px;border:1px solid #4a2730;background:#171014}b{color:#ff7185}</style><main><b>Could not connect Reddit</b><p>'+message+'</p></main>');
        });
        return;
      }
      const bridgeTrusted=_validBridgeKey(req.headers["x-sinrad-bridge-key"]);
      if(!bridgeTrusted){ _localJson(res,403,{ok:false,error:"extension authentication required"}); return; }
      if(origin) res.setHeader("Access-Control-Allow-Origin",origin); res.setHeader("Vary","Origin");
      res.setHeader("Access-Control-Allow-Methods","GET,POST,OPTIONS");
      res.setHeader("Access-Control-Allow-Headers","Content-Type,X-Sinrad-Token,X-Sinrad-Bridge-Key");
      if(req.method==="GET" && u.pathname==="/token"){ _localJson(res,200,{ok:true,token:LOCAL_TOKEN},origin); return; }
      const allowedPosts=new Set(["/park","/capture/start","/capture/chunk","/capture/finish","/capture/cancel"]);
      if(req.method!=="POST" || !allowedPosts.has(u.pathname)){ _localJson(res,404,{ok:false,error:"not found"},origin); return; }
      if(req.headers["x-sinrad-token"]!==LOCAL_TOKEN){ _localJson(res,401,{ok:false,error:"invalid token"},origin); return; }
      if(u.pathname==="/capture/chunk"){
        _readLocalBody(req,1024*1024,true).then(function(bytes){const received=_captureAppend(u.searchParams.get("id"),Number(u.searchParams.get("index")),bytes);_localJson(res,200,{ok:true,received:received},origin);}).catch(function(error){_localJson(res,error&&error.message==="request too large"?413:400,{ok:false,error:String(error&&error.message||error)},origin);});return;
      }
      const now=Date.now(); _localHits=_localHits.filter(function(t){return now-t<60000;});
      if(_localHits.length>=120){ _localJson(res,429,{ok:false,error:"rate limit"},origin); return; }
      _localHits.push(now);
      const jsonLimit=u.pathname==="/park"?1048576:(u.pathname==="/capture/start"?4194304:65536);
      _readLocalBody(req,jsonLimit,false).then(async function(body){
        try{
          const data=JSON.parse(body||"{}");
          if(u.pathname==="/capture/start"){const id=_captureStart(data);_localJson(res,200,{ok:true,captureId:id},origin);return;}
          if(u.pathname==="/capture/finish"){const result=await _captureFinish(data.captureId);_localJson(res,200,result,origin);return;}
          if(u.pathname==="/capture/cancel"){const session=_captureSessions.get(String(data.captureId||""));_captureRemove(session);_localJson(res,200,{ok:true},origin);return;}
          const lot=data.lot===true;
          if(Array.isArray(data.tabs)){
            if(!lot){ _localJson(res,400,{ok:false,error:"tab batches are Parking Lot only"},origin); return; }
            if(!data.tabs.length||data.tabs.length>1000){ _localJson(res,400,{ok:false,error:"batch must contain 1 to 1000 tabs"},origin); return; }
            const tabs=data.tabs.map(function(tab){return {url:normalizeHttpUrl(tab&&tab.url),title:String(tab&&tab.title||"").slice(0,500)};}).filter(function(tab){return !!tab.url;});
            if(!tabs.length){ _localJson(res,400,{ok:false,error:"http(s) tabs required"},origin); return; }
            const result=await _sendParkWithAck({tabs:tabs,lot:true,batch:true}); _localJson(res,result.ok?200:503,Object.assign({},result,{count:tabs.length}),origin); return;
          }
          const linkUrl=normalizeHttpUrl(data.url),title=String(data.title||"").slice(0,500);
          if(!linkUrl){ _localJson(res,400,{ok:false,error:"http(s) URL required"},origin); return; }
          const result=await _sendParkWithAck({url:linkUrl,title:title,lot:lot}); _localJson(res,result.ok?200:503,result,origin);
        }catch(err){ _localJson(res,400,{ok:false,error:String(err&&err.message||"invalid JSON")},origin); }
      }).catch(function(error){_localJson(res,error&&error.message==="request too large"?413:400,{ok:false,error:String(error&&error.message||error)},origin);});
    });
    _localServer.on('error', function(e){ console.error('[sinrad] local server port '+LOCAL_PORT+' unavailable:', e.message); _localServer=null; });
    _localServer.listen(LOCAL_PORT, '127.0.0.1');
  }catch(e){ console.error('[sinrad] local server failed:', e.message); }
}
// --- configurable hotkeys (module scope so settings apply immediately) ---
const {globalShortcut}=require('electron');
const HOTKEY_DEFAULTS={globalSearch:"Ctrl+Shift+F",commandPalette:"Ctrl+Shift+P",undo:"Ctrl+Z",quickSave:"Ctrl+Alt+P"};
function _normalizeHotkey(value,fallback){
  const parts=String(value||"").replace(/\s+/g,"").split("+").filter(Boolean),mods={ctrl:false,alt:false,shift:false};let key="";
  parts.forEach(function(part){const upper=part.toUpperCase();if(upper==="CTRL"||upper==="CONTROL"||upper==="COMMANDORCONTROL"||upper==="CMD")mods.ctrl=true;else if(upper==="ALT")mods.alt=true;else if(upper==="SHIFT")mods.shift=true;else if(/^[A-Z0-9]$/.test(upper)||/^F(?:[1-9]|1[0-2])$/.test(upper))key=upper;});
  if(!key||(!mods.ctrl&&!mods.alt))return fallback;
  return [mods.ctrl?"Ctrl":"",mods.alt?"Alt":"",mods.shift?"Shift":"",key].filter(Boolean).join("+");
}
function _sanitizeHotkeys(value){const source=value&&typeof value==="object"?value:{};const out={};Object.keys(HOTKEY_DEFAULTS).forEach(function(name){out[name]=_normalizeHotkey(source[name],HOTKEY_DEFAULTS[name]);});return out;}
function _inputHotkey(input){if(!input)return "";const key=String(input.key||"").toUpperCase();if(!(/^[A-Z0-9]$/.test(key)||/^F(?:[1-9]|1[0-2])$/.test(key)))return "";return [(input.control||input.meta)?"Ctrl":"",input.alt?"Alt":"",input.shift?"Shift":"",key].filter(Boolean).join("+");}
function _hotkeyAccelerator(combo){return String(combo||HOTKEY_DEFAULTS.quickSave).replace(/^Ctrl\+/,"CommandOrControl+");}
let _runtimeHotkeys=_sanitizeHotkeys(null),_hkCombo=_runtimeHotkeys.quickSave,_hotkeyCapture=false;
function _hkCb(){ try{ const t=require('electron').clipboard.readText(); if(mainWin){ mainWin.webContents.send('hotkey-park', t); if(mainWin.isMinimized())mainWin.restore(); mainWin.show(); mainWin.focus(); } }catch(_){} }
let _hkOk=false; let _hkEnabled=true;
function _hkRegister(){ try{ if(_hkEnabled&&!_hkOk&&!_hotkeyCapture){ _hkOk=!!globalShortcut.register(_hotkeyAccelerator(_hkCombo), _hkCb); } }catch(_){} }
function _hkUnregister(){ try{ if(_hkOk){ globalShortcut.unregister(_hotkeyAccelerator(_hkCombo)); _hkOk=false; } }catch(_){} }
function _applyHotkeys(value){const next=_sanitizeHotkeys(value),quickChanged=next.quickSave!==_hkCombo;if(quickChanged)_hkUnregister();_runtimeHotkeys=next;_hkCombo=next.quickSave;if(_hkEnabled)_hkRegister();return Object.assign({},_runtimeHotkeys);}
app.whenReady().then(()=>{
  if(!_gotLock) return;
  _installMonitorMediaProtocol();
  _installOfflineMediaProtocol();
  migrateLegacyStore();
  syncBrowserExtension();
  fs.promises.mkdir(THUMBNAIL_DIR,{recursive:true,mode:0o700}).then(function(){ return pruneThumbnailCache(THUMBNAIL_DIR,THUMBNAIL_LIMITS); }).catch(function(){});
  fs.promises.mkdir(SITE_PREVIEW_DIR,{recursive:true,mode:0o700}).then(function(){ return pruneThumbnailCache(SITE_PREVIEW_DIR,SITE_PREVIEW_LIMITS); }).catch(function(){});
  const cachePruneTimer=setInterval(function(){pruneThumbnailCache(THUMBNAIL_DIR,THUMBNAIL_LIMITS).catch(function(){});},6*60*60*1000); if(cachePruneTimer.unref)cachePruneTimer.unref();
  const previewPruneTimer=setInterval(function(){pruneThumbnailCache(SITE_PREVIEW_DIR,SITE_PREVIEW_LIMITS).catch(function(){});},6*60*60*1000); if(previewPruneTimer.unref)previewPruneTimer.unref();
  try{ _killRestore(); }catch(_){}
  syncBoot();
  syncAnimations();
  try{ if(autoUpdater){ autoUpdater.autoDownload=false; autoUpdater.autoInstallOnAppQuit=true; autoUpdater.allowDowngrade=false; autoUpdater.allowPrerelease=false; try{ autoUpdater.setFeedURL({provider:"github",owner:"SinSeeker0",repo:"sinrad"}); }catch(_){} autoUpdater.on("error", function(e){ try{ console.error("[sinrad] autoUpdater:", e&&e.message); }catch(_){} }); } }catch(_e){ try{ console.error("[sinrad] autoUpdater config failed:", _e&&_e.message); }catch(_){} }
  const vid=pickBootVideo();
  const _st=readStore(); const _introOn=!(_st&&_st.settings&&_st.settings.introEnabled===false);
  if(vid && _introOn){ hasSplash=true; createSplash(vid); if(!splashWin) hasSplash=false; }
  createWindow();
  _startLocalServer();
  try{offlineFeed.load();offlineFeed.prune();}catch(error){console.error("[sinrad] offline feed init failed:",error.message);}
  try{monitoringStore.load();monitoringStore.prune();}catch(error){console.error("[sinrad] monitoring init failed:",error.message);}
  const offlineStartupTimer=setTimeout(function(){if(_redditAuthStatus().connected)_refreshOfflineFeed("",false).catch(function(){});},30000);if(offlineStartupTimer.unref)offlineStartupTimer.unref();
  const offlineRefreshTimer=setInterval(function(){if(_redditAuthStatus().connected)_refreshOfflineFeed("",false).catch(function(){});},15*60*1000);if(offlineRefreshTimer.unref)offlineRefreshTimer.unref();
  const monitoringStartupTimer=setTimeout(function(){_refreshMonitoring("",false).catch(function(){});},45000);if(monitoringStartupTimer.unref)monitoringStartupTimer.unref();
  const monitoringRefreshTimer=setInterval(function(){_refreshMonitoring("",false).catch(function(){});},5*60*1000);if(monitoringRefreshTimer.unref)monitoringRefreshTimer.unref();
  var _protoArg=process.argv.find(function(a){return a.startsWith(PROTOCOL+"://");}); if(_protoArg){ mainWin.webContents.once("did-finish-load",function(){ _handleProtocolUrl(_protoArg); }); }
  try{ mainWin.webContents.once('did-finish-load', function(){ try{ mainWin.webContents.send('data-path', DATA_FILE); }catch(_){} }); }catch(_){}
  _hkEnabled=!(_st&&_st.settings&&_st.settings.hotkeyEnabled===false);_applyHotkeys(_st&&_st.settings&&_st.settings.hotkeys);if(_hkEnabled){ _hkRegister(); } try{ mainWin.webContents.once('did-finish-load', function(){ try{ mainWin.webContents.send('hotkey-status',{ok:_hkOk,combo:_hkCombo,enabled:_hkEnabled}); }catch(_){} }); }catch(_){}
  var _rgTries=0;
  function _closeSplash(){ try{ if(splashWin && !splashWin.isDestroyed()) splashWin.close(); }catch(_){} splashWin=null; }
  if(mainWin&&mainWin.webContents) mainWin.webContents.on("render-process-gone", function(_e, details){ try{ console.error("[sinrad] renderer gone:", details&&details.reason); _closeSplash(); if(_rgTries++ < 3){ setTimeout(function(){ try{ if(mainWin&&!mainWin.isDestroyed()){ mainWin.reload(); mainWin.show(); } }catch(_){} }, 1500); } else { try{ mainWin.show(); }catch(_){} } }catch(_){} });
  mainWin.once("ready-to-show",()=>{ mainReady=true; if(!hasSplash || bootFinished){ bootFinished=true; showMain(); } });
  // pure anti-brick guard: never stay stuck on the splash forever (10 min cap)
  setTimeout(finishBoot, 600000);
  app.on("activate", ()=>{ if(BrowserWindow.getAllWindows().length===0) createWindow(); });
});
function _from(e,win){ return !!(e&&win&&!win.isDestroyed()&&e.sender===win.webContents); }
function _fromMain(e){ return _from(e,mainWin); }
function _fromPet(e){ return _from(e,petWin); }
function _fromSplash(e){ return _from(e,splashWin); }
ipcMain.on("boot-done", (e)=>{ if(_fromSplash(e)) finishBoot(); });
ipcMain.on("protocol-park-ack",(e,requestId,ok)=>{ if(!_fromMain(e)||typeof requestId!=="string")return; const done=_pendingParkAcks.get(requestId); if(done){ _pendingParkAcks.delete(requestId); done(!!ok); } });
app.on("before-quit", ()=>{ try{ _killPersist(); }catch(_){} });
app.on("window-all-closed", ()=>{ if(process.platform!=="darwin") app.quit(); });

/* ---------- IPC: main window controls ---------- */
ipcMain.on("win-min",  (e)=>{ if(_fromMain(e)) mainWin.minimize(); });
ipcMain.on("win-max",  (e)=>{ if(_fromMain(e)){ mainWin.isMaximized()?mainWin.unmaximize():mainWin.maximize(); } });
ipcMain.on("win-close",(e)=>{ if(_fromMain(e)) mainWin.close(); });

/* ---------- IPC: open urls / local apps ---------- */
ipcMain.on("shell-open", (e,url)=>{ if(!_fromMain(e)) return; const safe=normalizeHttpUrl(url); if(safe) shell.openExternal(safe); });
ipcMain.handle("open-path", async (e,p)=>{ if(!(_fromMain(e)||_fromPet(e))||typeof p!=="string"||!p||p.indexOf("\0")>=0) return false; try{ const resolved=path.resolve(p); if(!fs.existsSync(resolved)) return false; const err=await shell.openPath(resolved); if(err) return false; try{ _recordRecentFolder(resolved); }catch(_){} return true; }catch(err){ return false; } });

/* ---------- IPC: store ---------- */
ipcMain.handle("store-load", (e)=>_fromMain(e)?readStore():null);
ipcMain.handle("store-security", (e)=>_fromMain(e)?storeSecurity():"unknown");
ipcMain.handle("store-save", (e,data)=>_fromMain(e)?writeStore(data):false);
ipcMain.handle("link-check", (e,url)=>_fromMain(e)?checkLink(url):{status:"blocked",code:0,error:"unauthorized"});
ipcMain.handle("offline-load",(e)=>_fromMain(e)?_offlineState():null);
ipcMain.handle("offline-storage-open",async(e)=>{if(!_fromMain(e))return false;try{_prepareOfflineRoot(offlineFeed.root);return !(await shell.openPath(offlineFeed.root));}catch(_){return false;}});
ipcMain.handle("offline-storage-choose",async(e)=>{
  if(!_fromMain(e))return {ok:false,error:"unauthorized"};
  if(_captureSessions.size)return {ok:false,error:"Wait for the current offline save to finish"};
  try{const picked=await dialog.showOpenDialog(mainWin,{title:"Choose the SINRAD offline folder",defaultPath:offlineFeed.root,properties:["openDirectory","createDirectory"]});if(picked.canceled||!picked.filePaths[0])return {ok:false,canceled:true};const snapshot=await _switchOfflineRoot(picked.filePaths[0]);_offlineNotify();return {ok:true,snapshot:snapshot};}catch(error){return {ok:false,error:String(error&&error.message||error)};}
});
ipcMain.handle("offline-auth-status",(e)=>_fromMain(e)?_redditAuthStatus():{connected:false});
ipcMain.handle("offline-reddit-connect",async(e,input)=>{
  if(!_fromMain(e))return {ok:false,error:"unauthorized"};
  try{
    const clientId=String(input&&input.clientId||"").trim(),username=RedditSource.cleanUsername(input&&input.username);
    const state=crypto.randomBytes(24).toString("hex");
    _redditPendingAuth={clientId:clientId,username:username,state:state,createdAt:Date.now()};
    const url=RedditSource.authorizationUrl(clientId,state,REDDIT_REDIRECT);
    await shell.openExternal(url);
    return {ok:true};
  }catch(error){_redditPendingAuth=null;return {ok:false,error:String(error&&error.message||error)};}
});
ipcMain.handle("offline-reddit-disconnect",(e)=>{if(!_fromMain(e))return false;_writeRedditAuth(null);_offlineNotify();return true;});
ipcMain.handle("offline-source-add",(e,input)=>{
  if(!_fromMain(e))return {ok:false,error:"unauthorized"};
  try{
    if(!input||input.platform!=="reddit")throw new Error("That source is not available yet");
    if(!_redditAuthStatus().connected)throw new Error("Connect Reddit first");
    const subreddit=RedditSource.cleanSubreddit(input.handle);
    const source=offlineFeed.addSource(Object.assign({},input,{platform:"reddit",handle:subreddit,label:"r/"+subreddit}));
    _offlineNotify();setTimeout(function(){_refreshOfflineFeed(source.id,true).catch(function(){});},20);
    return {ok:true,source:source};
  }catch(error){return {ok:false,error:String(error&&error.message||error)};}
});
ipcMain.handle("offline-source-remove",(e,id,deleteItems)=>{if(!_fromMain(e))return false;const ok=offlineFeed.removeSource(String(id||""),!!deleteItems);if(ok)_offlineNotify();return ok;});
ipcMain.handle("offline-settings",(e,input)=>{if(!_fromMain(e))return null;try{offlineFeed.configure(input);const data=_offlineState();_offlineNotify();return data;}catch(_){return null;}});
ipcMain.handle("offline-item-update",(e,id,patch)=>{if(!_fromMain(e))return null;const item=offlineFeed.updateItem(String(id||""),patch);if(item)_offlineNotify();return item;});
ipcMain.handle("offline-refresh",async(e,sourceId)=>{if(!_fromMain(e))return {ok:false,error:"unauthorized"};try{return await _refreshOfflineFeed(String(sourceId||""),true);}catch(error){return {ok:false,error:String(error&&error.message||error)};}});
ipcMain.handle("offline-media",async(e,ref)=>{
  if(!_fromMain(e))return "";
  try{const media=await offlineFeed.readMedia(ref);if(!media)return "";return "data:"+_offlineMediaMime(media.extension)+";base64,"+media.bytes.toString("base64");}catch(_){return "";}
});
ipcMain.handle("offline-capture-open",async(e,ref)=>{if(!_fromMain(e))return {ok:false,error:"unauthorized"};try{return {ok:_openOfflineCapture(String(ref||""))};}catch(error){return {ok:false,error:String(error&&error.message||error)};}});
ipcMain.handle("monitoring-load",(e)=>_fromMain(e)?monitoringStore.snapshot():null);
ipcMain.handle("monitoring-add",(e,input)=>{
  if(!_fromMain(e))return {ok:false,error:"unauthorized"};
  try{
    const target=MonitoringSources.parseTarget(input&&input.url),snapshot=monitoringStore.snapshot();
    const monitor=monitoringStore.add({target:target,label:String(input&&input.label||target.label||"").trim(),intervalMinutes:Number(input&&input.intervalMinutes)||snapshot.settings.defaultIntervalMinutes});
    _monitoringNotify();setTimeout(function(){_refreshMonitoring(monitor.id,true).catch(function(){});},30);return {ok:true,monitor:monitor};
  }catch(error){return {ok:false,error:String(error&&error.message||error)};}
});
ipcMain.handle("monitoring-remove",(e,id)=>{if(!_fromMain(e))return false;const ok=monitoringStore.remove(String(id||""));if(ok)_monitoringNotify();return ok;});
ipcMain.handle("monitoring-monitor-update",(e,id,patch)=>{if(!_fromMain(e))return null;const result=monitoringStore.updateMonitor(String(id||""),patch||{});if(result)_monitoringNotify();return result;});
ipcMain.handle("monitoring-event-update",(e,id,patch)=>{if(!_fromMain(e))return null;const result=monitoringStore.updateEvent(String(id||""),patch||{});if(result)_monitoringNotify();return result;});
ipcMain.handle("monitoring-mark-read",(e)=>{if(!_fromMain(e))return false;const result=monitoringStore.markAllRead();if(result)_monitoringNotify();return result;});
ipcMain.handle("monitoring-settings",(e,patch)=>{if(!_fromMain(e))return null;try{const result=monitoringStore.configure(patch||{});_monitoringNotify();return result;}catch(_){return null;}});
ipcMain.handle("monitoring-output-open",async(e)=>{if(!_fromMain(e))return false;try{return !(await shell.openPath(await _monitoringOutputFolder()));}catch(_){return false;}});
ipcMain.handle("monitoring-output-choose",async(e)=>{
  if(!_fromMain(e))return {ok:false,error:"unauthorized"};
  try{const current=monitoringStore.snapshot().settings.downloadFolder||app.getPath("downloads"),picked=await dialog.showOpenDialog(mainWin,{title:"Choose the Monitoring download folder",defaultPath:current,properties:["openDirectory","createDirectory"]});if(picked.canceled||!picked.filePaths[0])return {ok:false,canceled:true};await fs.promises.mkdir(picked.filePaths[0],{recursive:true,mode:0o700});const snapshot=monitoringStore.setDownloadFolder(picked.filePaths[0]);_monitoringNotify();return {ok:true,snapshot:snapshot};}catch(error){return {ok:false,error:String(error&&error.message||error)};}
});
ipcMain.handle("monitoring-refresh",async(e,id)=>{if(!_fromMain(e))return {ok:false,error:"unauthorized"};try{return await _refreshMonitoring(String(id||""),true);}catch(error){return {ok:false,error:String(error&&error.message||error)};}});
ipcMain.handle("monitoring-media",async(e,ref)=>{
  if(!_fromMain(e))return "";
  try{const media=await monitoringStore.readMedia(ref);if(!media)return "";const mime={".jpg":"image/jpeg",".jpeg":"image/jpeg",".png":"image/png",".webp":"image/webp",".gif":"image/gif"}[media.extension]||"application/octet-stream";return "data:"+mime+";base64,"+media.bytes.toString("base64");}catch(_){return "";}
});
ipcMain.handle("monitoring-post-detail",async(e,id)=>{if(!_fromMain(e))return {ok:false,error:"unauthorized"};try{return {ok:true,detail:await _pawchivePostDetail(String(id||""))};}catch(error){return {ok:false,error:String(error&&error.message||error)};}});
ipcMain.handle("monitoring-download",async(e,id,index)=>{if(!_fromMain(e))return {ok:false,error:"unauthorized"};try{return await _downloadPawchiveFile(String(id||""),index);}catch(error){return {ok:false,error:String(error&&error.message||error)};}});
ipcMain.handle("monitoring-download-all",async(e,id)=>{if(!_fromMain(e))return {ok:false,error:"unauthorized"};try{return await _downloadAllPawchiveFiles(String(id||""));}catch(error){return {ok:false,error:String(error&&error.message||error)};}});
ipcMain.handle("monitoring-artist-detail",async(e,id)=>{if(!_fromMain(e))return {ok:false,error:"unauthorized"};try{return {ok:true,artist:await _pawchiveArtistDetail(String(id||""))};}catch(error){return {ok:false,error:String(error&&error.message||error)};}});
ipcMain.handle("monitoring-artist-post-detail",async(e,monitorId,postId)=>{if(!_fromMain(e))return {ok:false,error:"unauthorized"};try{return {ok:true,detail:await _pawchiveArtistPostDetail(String(monitorId||""),String(postId||""))};}catch(error){return {ok:false,error:String(error&&error.message||error)};}});
ipcMain.handle("monitoring-artist-download",async(e,monitorId,postId,index)=>{if(!_fromMain(e))return {ok:false,error:"unauthorized"};try{return await _downloadArtistPostFile(String(monitorId||""),String(postId||""),index);}catch(error){return {ok:false,error:String(error&&error.message||error)};}});
ipcMain.handle("monitoring-artist-post-download-all",async(e,monitorId,postId)=>{if(!_fromMain(e))return {ok:false,error:"unauthorized"};try{return await _downloadArtistPostFiles(String(monitorId||""),String(postId||""));}catch(error){return {ok:false,error:String(error&&error.message||error)};}});
ipcMain.handle("monitoring-artist-download-all",async(e,monitorId,fromDate,toDate)=>{if(!_fromMain(e))return {ok:false,error:"unauthorized"};try{return await _downloadPawchiveArtist(String(monitorId||""),String(fromDate||""),String(toDate||""));}catch(error){return {ok:false,error:String(error&&error.message||error)};}});
function _backupEncrypt(data,password){
  const clean=_validStore(JSON.parse(JSON.stringify(data)));
  if(!clean) throw new Error("Invalid S.I.R data");
  const plain=Buffer.from(JSON.stringify(clean),"utf8");
  if(plain.length>10*1024*1024) throw new Error("Backup exceeds 10 MB safety limit");
  const salt=crypto.randomBytes(16),iv=crypto.randomBytes(12);
  const key=crypto.scryptSync(password,salt,32,{N:16384,r:8,p:1,maxmem:64*1024*1024});
  const cipher=crypto.createCipheriv("aes-256-gcm",key,iv);
  const encrypted=Buffer.concat([cipher.update(plain),cipher.final()]);
  return JSON.stringify({format:"sinrad-password-backup-v1",kdf:"scrypt",cipher:"aes-256-gcm",salt:salt.toString("base64"),iv:iv.toString("base64"),tag:cipher.getAuthTag().toString("base64"),payload:encrypted.toString("base64")});
}
function _backupDecrypt(raw,password){
  const box=JSON.parse(raw);
  if(!box||box.format!=="sinrad-password-backup-v1") throw new Error("Not a supported S.I.R backup");
  const salt=Buffer.from(box.salt||"","base64"),iv=Buffer.from(box.iv||"","base64"),tag=Buffer.from(box.tag||"","base64"),payload=Buffer.from(box.payload||"","base64");
  if(salt.length!==16||iv.length!==12||tag.length!==16||payload.length>10*1024*1024) throw new Error("Backup file is invalid");
  const key=crypto.scryptSync(password,salt,32,{N:16384,r:8,p:1,maxmem:64*1024*1024});
  const decipher=crypto.createDecipheriv("aes-256-gcm",key,iv); decipher.setAuthTag(tag);
  return _validStore(JSON.parse(Buffer.concat([decipher.update(payload),decipher.final()]).toString("utf8")));
}
ipcMain.handle("backup-export",async(e,data,password)=>{
  if(!_fromMain(e)||typeof password!=="string"||password.length<8)return {ok:false,error:"Use a password with at least 8 characters"};
  try{
    const stamp=new Date().toISOString().slice(0,10);
    const picked=await require("electron").dialog.showSaveDialog(mainWin,{title:"Save encrypted S.I.R backup",defaultPath:"sinrad-backup-"+stamp+".sirbackup",filters:[{name:"S.I.R encrypted backup",extensions:["sirbackup"]}]});
    if(picked.canceled||!picked.filePath)return {ok:false,canceled:true};
    await fs.promises.writeFile(picked.filePath,_backupEncrypt(data,password),{encoding:"utf8",mode:0o600});
    return {ok:true};
  }catch(err){return {ok:false,error:String(err&&err.message||err)};}
});
ipcMain.handle("backup-import",async(e,password)=>{
  if(!_fromMain(e)||typeof password!=="string"||!password)return {ok:false,error:"Enter the backup password"};
  try{
    const picked=await require("electron").dialog.showOpenDialog(mainWin,{title:"Open encrypted S.I.R backup",properties:["openFile"],filters:[{name:"S.I.R encrypted backup",extensions:["sirbackup"]}]});
    if(picked.canceled||!picked.filePaths[0])return {ok:false,canceled:true};
    const stat=await fs.promises.stat(picked.filePaths[0]); if(!stat.isFile()||stat.size>15*1024*1024)throw new Error("Backup file is too large");
    const data=_backupDecrypt(await fs.promises.readFile(picked.filePaths[0],"utf8"),password);
    if(!data)throw new Error("Backup data is invalid");
    return {ok:true,data:data};
  }catch(err){return {ok:false,error:"Could not unlock backup. Check the password and file."};}
});

/* ---------- IPC: pet window ---------- */
ipcMain.on("pet-show", (e)=>{ if(_fromMain(e)) showPet(); });
ipcMain.on("pet-hide", (e)=>{ if(_fromMain(e)) hidePet(); });
ipcMain.on("pet-drag-start", (e,off)=>{ if(_fromPet(e)) startDrag(off); });
ipcMain.on("pet-drag-end",   (e)=>{ if(_fromPet(e)) stopDrag(); });
ipcMain.on("set-mouse-ignore", (e,b,opts)=>{ if(_fromPet(e)) petWin.setIgnoreMouseEvents(!!b, opts||{}); });
ipcMain.on("pet-nav", (e,mod)=>{ if(_fromPet(e)&&["vault","links","folders","shots","lot"].indexOf(mod)>=0&&mainWin){ mainWin.webContents.send("norma-nav", mod); if(mainWin.isMinimized()) mainWin.restore(); mainWin.show(); mainWin.moveTop(); mainWin.focus(); } });
ipcMain.on("pet-pin", (e)=>{ if(!_fromPet(e))return; hidePet(); if(mainWin){ if(mainWin.isMinimized()) mainWin.restore(); mainWin.show(); mainWin.moveTop(); mainWin.focus(); mainWin.webContents.send("norma-dock"); } });

/* ---------- pet recent / pinned folders ---------- */
let _petSlots=[];
function _normFolderPath(p){ try{ return path.resolve(String(p||"")); }catch(_){ return String(p||""); } }
function _folderInfo(p){
  if(typeof p!=="string"||!p) return null;
  try{
    let resolved=_normFolderPath(p);
    if(!resolved) return null;
    if(fs.existsSync(resolved)){
      const st=fs.statSync(resolved);
      if(!st.isDirectory()) resolved=path.dirname(resolved);
    }
    return { path:resolved, name:path.basename(resolved)||resolved, ts:Date.now() };
  }catch(_){ return null; }
}
function _slotsFromStore(){
  const st=readStore()||{};
  const pins=Array.isArray(st.petPins)?st.petPins:[];
  const recents=Array.isArray(st.petRecents)?st.petRecents:[];
  const slots=[]; const seen=new Set();
  function push(item, pinned){
    if(slots.length>=3 || !item || !item.path) return;
    const k=_normFolderPath(item.path).toLowerCase();
    if(!k || seen.has(k)) return;
    seen.add(k);
    let label=item.name||path.basename(item.path);
    const folders=Array.isArray(st.folders)?st.folders:[];
    for(let i=0;i<folders.length;i++){
      const f=folders[i];
      if(_normFolderPath(f.path||"").toLowerCase()===k){
        label=(f.name&&f.path)?f.name:(f.name||path.basename(f.path||item.path));
        break;
      }
    }
    slots.push({ path:item.path, name:label, pinned:!!pinned });
  }
  pins.forEach(function(x){ push(x, true); });
  recents.forEach(function(x){ push(x, false); });
  return slots;
}
function syncPetRecents(slots){
  if(Array.isArray(slots)) _petSlots=slots;
  else if(!_petSlots.length) _petSlots=_slotsFromStore();
  try{ if(petWin && !petWin.isDestroyed()) petWin.webContents.send("recent-folders-update", _petSlots); }catch(_){}
}
function _recordRecentFolder(p){
  const info=_folderInfo(p);
  if(!info) return;
  try{
    if(mainWin && !mainWin.isDestroyed()){ mainWin.webContents.send("record-recent-folder", info); }
    else {
      const st=readStore()||{};
      let recents=Array.isArray(st.petRecents)?st.petRecents.slice():[];
      const key=String(info.path).toLowerCase();
      recents=recents.filter(function(r){ return String((r&&r.path)||"").toLowerCase()!==key; });
      recents.unshift(info);
      if(recents.length>20) recents.length=20;
      st.petRecents=recents;
      writeStore(st);
      _petSlots=_slotsFromStore();
    }
  }catch(_){}
}
ipcMain.on("sync-pet-recents", (e, slots)=>{ if(_fromMain(e)) syncPetRecents(slots); });
ipcMain.handle("pet-recents", (e)=> (_fromPet(e)||_fromMain(e))?(_petSlots.length?_petSlots:_slotsFromStore()):[]);

/* ---------- screenshot library (images only, watch-in-place) ---------- */
const SHOT_EXTS = { ".png":1, ".jpg":1, ".jpeg":1, ".webp":1, ".gif":1, ".bmp":1, ".jfif":1 };
const _thumbnailInflight=new Map();
const _thumbnailTouched=new Set();
let _thumbnailWrites=0;
const _thumbnailGenerationQueue=[];
let _thumbnailGenerationActive=0;
function _queueThumbnailGeneration(work){
  return new Promise(function(resolve,reject){ _thumbnailGenerationQueue.push({work:work,resolve:resolve,reject:reject}); _pumpThumbnailGeneration(); });
}
function _pumpThumbnailGeneration(){
  while(_thumbnailGenerationActive<4 && _thumbnailGenerationQueue.length){
    const job=_thumbnailGenerationQueue.shift(); _thumbnailGenerationActive++;
    Promise.resolve().then(job.work).then(job.resolve,job.reject).finally(function(){ _thumbnailGenerationActive--; _pumpThumbnailGeneration(); });
  }
}
const _sitePreviewInflight=new Map();
const _sitePreviewMisses=new Map();
const _sitePreviewQueue=[];
let _sitePreviewActive=0,_sitePreviewWrites=0;
function _queueSitePreview(work){return new Promise(function(resolve,reject){_sitePreviewQueue.push({work:work,resolve:resolve,reject:reject});_pumpSitePreviews();});}
function _pumpSitePreviews(){while(_sitePreviewActive<3&&_sitePreviewQueue.length){const job=_sitePreviewQueue.shift();_sitePreviewActive++;Promise.resolve().then(job.work).then(job.resolve,job.reject).finally(function(){_sitePreviewActive--;_pumpSitePreviews();});}}
function _previewImageResize(image,maxWidth,maxHeight){
  const size=image.getSize(),scale=Math.min(1,maxWidth/Math.max(1,size.width),maxHeight/Math.max(1,size.height));
  if(scale>=1)return image;
  return image.resize({width:Math.max(1,Math.round(size.width*scale)),height:Math.max(1,Math.round(size.height*scale)),quality:"good"});
}
function _sitePreviewIdentity(raw,mode){
  const normalized=normalizeHttpUrl(raw);if(!normalized)return null;
  mode=mode==="icon"?"icon":"rich";
  let identity=normalized;if(mode==="icon"){try{identity=new URL(normalized).origin+"/";}catch(_){}}
  return {url:normalized,mode:mode,key:crypto.createHash("sha256").update("site-preview-v1\0"+mode+"\0"+identity).digest("hex")};
}
async function _readSitePreviewCache(key){
  for(const ext of ["jpg","png"]){
    const file=path.join(SITE_PREVIEW_DIR,key+"."+ext);
    try{const stat=await fs.promises.stat(file);if(!stat.isFile()||Date.now()-stat.mtimeMs>SITE_PREVIEW_LIMITS.maxAgeMs){fs.promises.unlink(file).catch(function(){});continue;}const bytes=await fs.promises.readFile(file);fs.promises.utimes(file,new Date(),new Date()).catch(function(){});return {data:"data:image/"+(ext==="png"?"png":"jpeg")+";base64,"+bytes.toString("base64"),kind:ext==="png"?"icon":"rich"};}catch(_){}
  }
  return null;
}
async function _sitePreview(raw,mode){
  const id=_sitePreviewIdentity(raw,mode);if(!id)return null;
  const cached=await _readSitePreviewCache(id.key);if(cached)return cached;
  if((_sitePreviewMisses.get(id.key)||0)>Date.now())return null;
  if(_sitePreviewInflight.has(id.key))return await _sitePreviewInflight.get(id.key);
  const task=_queueSitePreview(async function(){
    try{
      const remote=await SitePreview.fetchSiteImage(id.url,id.mode),source=nativeImage.createFromBuffer(remote.bytes);
      if(!source||source.isEmpty())throw new Error("image could not be decoded");
      const icon=remote.kind==="icon",image=_previewImageResize(source,icon?96:520,icon?96:300),ext=icon?"png":"jpg",bytes=icon?image.toPNG():image.toJPEG(80);
      if(!bytes||!bytes.length)throw new Error("image conversion failed");
      await fs.promises.mkdir(SITE_PREVIEW_DIR,{recursive:true,mode:0o700});
      await fs.promises.writeFile(path.join(SITE_PREVIEW_DIR,id.key+"."+ext),bytes,{mode:0o600});
      if(++_sitePreviewWrites%30===1)pruneThumbnailCache(SITE_PREVIEW_DIR,SITE_PREVIEW_LIMITS).catch(function(){});
      return {data:"data:image/"+(ext==="png"?"png":"jpeg")+";base64,"+bytes.toString("base64"),kind:icon?"icon":"rich"};
    }catch(_){_sitePreviewMisses.set(id.key,Date.now()+30*60*1000);return null;}
  });
  _sitePreviewInflight.set(id.key,task);try{return await task;}finally{_sitePreviewInflight.delete(id.key);}
}
function _savedFolderPath(raw){
  if(typeof raw!=="string"||!raw||raw.indexOf("\0")>=0)return "";
  let resolved;try{resolved=path.resolve(raw);}catch(_){return "";}
  const folders=((readStore()||{}).folders||[]);
  const allowed=folders.some(function(folder){try{return path.resolve(String(folder&&folder.path||folder&&folder.name||"")).toLowerCase()===resolved.toLowerCase();}catch(_){return false;}});
  return allowed?resolved:"";
}
async function _folderPreview(raw){
  try{
    const folder=_savedFolderPath(raw);if(!folder)return "";
    const rootStat=await fs.promises.stat(folder);if(!rootStat.isDirectory())return "";
    const entries=await fs.promises.readdir(folder,{withFileTypes:true}),candidates=entries.filter(function(entry){return entry.isFile()&&!entry.isSymbolicLink()&&SHOT_EXTS[path.extname(entry.name).toLowerCase()];}).slice(0,300);
    let newest=null;
    await Promise.all(candidates.map(async function(entry){try{const file=path.join(folder,entry.name),stat=await fs.promises.stat(file);if(stat.isFile()&&(!newest||stat.mtimeMs>newest.stat.mtimeMs))newest={file:file,stat:stat};}catch(_){}}));
    if(!newest)return "";
    const key=thumbnailKey(newest.file,newest.stat),cached=path.join(THUMBNAIL_DIR,key+".jpg");
    try{const bytes=await fs.promises.readFile(cached);return "data:image/jpeg;base64,"+bytes.toString("base64");}catch(_){}
    if(_thumbnailInflight.has(key))return await _thumbnailInflight.get(key);
    const task=_queueThumbnailGeneration(async function(){
      let image=null;try{image=await nativeImage.createThumbnailFromPath(newest.file,{width:260,height:160});}catch(_){}
      if(!image||image.isEmpty())return "";
      const bytes=image.toJPEG(78);await fs.promises.mkdir(THUMBNAIL_DIR,{recursive:true,mode:0o700});await fs.promises.writeFile(cached,bytes,{mode:0o600});return "data:image/jpeg;base64,"+bytes.toString("base64");
    });
    _thumbnailInflight.set(key,task);try{return await task;}finally{_thumbnailInflight.delete(key);}
  }catch(_){return "";}
}
let _sessionShotRoots=[];
let _defaultShotRoots=null;
let _shotAllowedCache=[];
let _shotAllowedRevision=-1;
let _shotSessionRevision=0;
let _shotAllowedSessionRevision=-1;
function _shotsDefaultRoots(){
  if(_defaultShotRoots) return _defaultShotRoots.slice();
  const out=[], seen=new Set();
  function add(p){ if(!p) return; const r=path.resolve(p); const k=r.toLowerCase(); if(seen.has(k)) return; try{ if(fs.existsSync(r) && fs.statSync(r).isDirectory()){ seen.add(k); out.push(r); } }catch(_){} }
  try{ add(path.join(app.getPath("pictures"),"Screenshots")); }catch(_){}
  try{ add(path.join(app.getPath("home"),"Pictures","Screenshots")); }catch(_){}
  try{ add(path.join(app.getPath("home"),"OneDrive","Pictures","Screenshots")); }catch(_){}
  try{ add(path.join(app.getPath("home"),"OneDrive","Pictures","Screenshots")); }catch(_){}
  _defaultShotRoots=out; return out.slice();
}
function _shotAllowedRoots(){
  if(_shotAllowedRevision!==_storeRevision || _shotAllowedSessionRevision!==_shotSessionRevision){
    _shotAllowedCache=_sessionShotRoots.concat(((readStore()||{}).shotWatch||[]),_shotsDefaultRoots());
    _shotAllowedRevision=_storeRevision; _shotAllowedSessionRevision=_shotSessionRevision;
  }
  return _shotAllowedCache;
}
ipcMain.handle("site-preview",async(e,url,mode)=>_fromMain(e)?await _sitePreview(url,mode):null);
ipcMain.handle("folder-preview",async(e,folder)=>_fromMain(e)?await _folderPreview(folder):"");
ipcMain.handle("shots-scan", async (e, roots)=>{ if(!_fromMain(e))return {files:[],roots:[],error:"unauthorized"}; try{ const dirs=await validDirectories(Array.isArray(roots)?roots:_shotsDefaultRoots(),20); _sessionShotRoots=dirs; _shotSessionRevision++; return await listScreenshotFiles(dirs); }catch(err){ return { files:[], roots:[], error:String(err&&err.message||err) }; } });
ipcMain.handle("shots-defaults", async (e)=> _fromMain(e)?_shotsDefaultRoots():[]);
ipcMain.handle("shots-pick-folder", async (e)=>{
  if(!_fromMain(e)) return "";
  try{
    const r=await dialog.showOpenDialog({ title:"Watch a screenshot folder", properties:["openDirectory"] });
    const picked=(r&&!r.canceled&&r.filePaths&&r.filePaths[0])?r.filePaths[0]:""; if(picked&&_sessionShotRoots.indexOf(picked)<0){ _sessionShotRoots.push(picked); _shotSessionRevision++; } return picked;
  }catch(_){ return ""; }
});
ipcMain.handle("shots-thumb", async (e, p)=>{
  try{
    if(!_fromMain(e)||typeof p!=="string"||!p) return "";
    const resolved=path.resolve(p);
    const roots=_shotAllowedRoots();
    if(!isPathInside(resolved,roots)||!SHOT_EXTS[path.extname(resolved).toLowerCase()]) return "";
    const stat=await fs.promises.stat(resolved); if(!stat.isFile()) return "";
    const key=thumbnailKey(resolved,stat);
    if(_thumbnailInflight.has(key)) return await _thumbnailInflight.get(key);
    const task=(async function(){
      await fs.promises.mkdir(THUMBNAIL_DIR,{recursive:true,mode:0o700});
      const cached=path.join(THUMBNAIL_DIR,key+".jpg");
      try{ const bytes=await fs.promises.readFile(cached); if(!_thumbnailTouched.has(key)){_thumbnailTouched.add(key);fs.promises.utimes(cached,new Date(),new Date()).catch(function(){});if(_thumbnailTouched.size>2000)_thumbnailTouched.clear();} return "data:image/jpeg;base64,"+bytes.toString("base64"); }catch(_){}
      const bytes=await _queueThumbnailGeneration(async function(){
        let img=null;
        try{ img=await nativeImage.createThumbnailFromPath(resolved,{ width:360, height:220 }); }catch(_){}
        if(!img||img.isEmpty()){ img=nativeImage.createFromPath(resolved); if(img&&!img.isEmpty()) img=img.resize({ width:360, quality:"good" }); }
        return (!img||img.isEmpty())?null:img.toJPEG(78);
      });
      if(!bytes) return "";
      await fs.promises.writeFile(cached,bytes,{mode:0o600});
      if(++_thumbnailWrites%40===1) pruneThumbnailCache(THUMBNAIL_DIR,THUMBNAIL_LIMITS).catch(function(){});
      return "data:image/jpeg;base64,"+bytes.toString("base64");
    })();
    _thumbnailInflight.set(key,task);
    try{ return await task; }finally{ _thumbnailInflight.delete(key); }
  }catch(_){ return ""; }
});
ipcMain.handle("shots-read", async (e,p)=>{ try{ if(!_fromMain(e)||typeof p!=="string"||!p)return Buffer.alloc(0); const resolved=path.resolve(p); if(!isPathInside(resolved,_shotAllowedRoots())||!SHOT_EXTS[path.extname(resolved).toLowerCase()])return Buffer.alloc(0); const st=await fs.promises.stat(resolved); if(!st.isFile()||st.size>50*1024*1024)return Buffer.alloc(0); return await fs.promises.readFile(resolved); }catch(_){ return Buffer.alloc(0); } });
ipcMain.handle("shots-reveal", async (e, p)=>{ try{ if(!_fromMain(e)||typeof p!=="string"||!p)return false; if(!isPathInside(p,_shotAllowedRoots()))return false; shell.showItemInFolder(path.resolve(p)); return true; }catch(_){ return false; } });
ipcMain.handle("shots-lookup", async (e, p)=>{
  try{
    if(!_fromMain(e)||typeof p!=="string"||!p) return false;
    if(!isPathInside(p,_shotAllowedRoots()))return false;
    const img=nativeImage.createFromPath(path.resolve(p));
    if(img&&!img.isEmpty()) clipboard.writeImage(img);
    await shell.openExternal("https://lens.google.com/");
    return true;
  }catch(_){ return false; }
});
ipcMain.handle("shots-open", async (e, p)=>{ try{ if(!_fromMain(e)||typeof p!=="string"||!p)return false; if(!isPathInside(p,_shotAllowedRoots()))return false; return !(await shell.openPath(path.resolve(p))); }catch(_){ return false; } });
ipcMain.handle("shots-copy", async (e, p)=>{
  try{
    if(!_fromMain(e)||typeof p!=="string"||!p) return false;
    if(!isPathInside(p,_shotAllowedRoots()))return false;
    const img=nativeImage.createFromPath(path.resolve(p));
    if(!img||img.isEmpty()) return false;
    clipboard.writeImage(img);
    return true;
  }catch(_){ return false; }
});


/* ---------- sleep kill switch (shut down PC after N minutes) ---------- */
const { execFile } = require("child_process");
function _killFiles(){
  const out=[path.join(path.dirname(DATA_FILE), "sinrad-kill.json")];
  try{ const u=path.join(app.getPath("userData"), "sinrad-kill.json"); if(out.indexOf(u)<0) out.push(u); }catch(_){}
  return out;
}
let _killAt=0;
function _killPayload(){
  const armed=_killAt>Date.now();
  const left=armed?Math.max(0,_killAt-Date.now()):0;
  return { armed:armed, at:armed?_killAt:0, left:left };
}
function _killPersist(){
  const payload=_killPayload();
  _killFiles().forEach(function(f){
    try{
      if(payload.armed) fs.writeFileSync(f, JSON.stringify({at:payload.at, left:payload.left}), "utf8");
      else if(fs.existsSync(f)) fs.unlinkSync(f);
    }catch(_){}
  });
}
function _killRestore(){
  let at=0;
  _killFiles().forEach(function(f){
    if(at) return;
    try{
      if(!fs.existsSync(f)) return;
      const j=JSON.parse(fs.readFileSync(f,"utf8"));
      at=parseInt(j&&j.at,10)||0;
    }catch(_){}
  });
  if(!at){
    try{
      const st=readStore();
      at=parseInt(st&&st.settings&&st.settings.killAt,10)||0;
    }catch(_){}
  }
  if(at>Date.now()) _killAt=at;
  else { _killAt=0; }
  _killPersist();
}
function _killBroadcast(){
  if(_killAt && _killAt<=Date.now()){ _killAt=0; _killPersist(); }
  const payload=_killPayload();
  try{ if(mainWin&&!mainWin.isDestroyed()) mainWin.webContents.send("kill-status", payload); }catch(_){}
  try{ if(petWin&&!petWin.isDestroyed()) petWin.webContents.send("kill-status", payload); }catch(_){}
}
function _killArm(mins){
  if(_killAt>Date.now()){ _killBroadcast(); return { armed:true, at:_killAt }; }
  mins=Math.max(1, parseInt(mins,10)||30);
  const sec=mins*60;
  _killAt=Date.now()+sec*1000;
  _killPersist();
  if(process.platform==="win32"){
    execFile("shutdown.exe", ["/s","/t",String(sec),"/c","Your pc is going to be shutdown gang"], { windowsHide:true }, function(err){
      if(err){
        const msg=String(err&&err.message||err);
        if(/already been scheduled|\b1190\b/i.test(msg)){
          if(!_killAt || _killAt<=Date.now()) _killAt=Date.now()+sec*1000;
        } else {
          console.error("[sinrad] shutdown arm:", msg);
          _killAt=0;
        }
        _killPersist();
      }
      _killBroadcast();
    });
  } else {
    execFile("shutdown", ["-h","+"+String(mins)], function(err){
      if(err){
        _killTimer=setTimeout(function(){
          execFile("systemctl", ["poweroff"], function(){ execFile("loginctl", ["poweroff"], function(){}); });
        }, sec*1000);
      }
      _killBroadcast();
    });
  }
  _killBroadcast();
  return { armed:true, at:_killAt };
}
let _killTimer=null;
function _killCancel(){
  _killAt=0;
  _killPersist();
  if(_killTimer){ clearTimeout(_killTimer); _killTimer=null; }
  if(process.platform==="win32"){
    execFile("shutdown.exe", ["/a"], { windowsHide:true }, function(){ _killBroadcast(); });
  } else {
    execFile("shutdown", ["-c"], function(){ _killBroadcast(); });
  }
  _killBroadcast();
  return { armed:false, at:0 };
}
function _killToggle(mins){
  if(_killAt>Date.now()) return _killCancel();
  return _killArm(mins);
}
ipcMain.handle("kill-arm", (e, mins)=> (_fromMain(e)||_fromPet(e))?_killArm(Math.min(1440,Math.max(1,Number(mins)||30))):{armed:false,at:0});
ipcMain.handle("kill-cancel", (e)=> (_fromMain(e)||_fromPet(e))?_killCancel():{armed:false,at:0});
ipcMain.handle("kill-toggle", (e, mins)=> (_fromMain(e)||_fromPet(e))?_killToggle(Math.min(1440,Math.max(1,Number(mins)||30))):{armed:false,at:0});
ipcMain.handle("kill-status", (e)=> (_fromMain(e)||_fromPet(e))?_killPayload():{armed:false,at:0});
ipcMain.on("kill-ask", (e)=>{
  if(!_fromPet(e)) return;
  try{
    if(mainWin&&!mainWin.isDestroyed()){
      if(mainWin.isMinimized()) mainWin.restore();
      mainWin.show(); mainWin.focus();
      mainWin.webContents.send("kill-ask");
    }
  }catch(_){}
});

ipcMain.handle("clip-read", async (e) => { if(!_fromMain(e))return ""; try { return require("electron").clipboard.readText(); } catch(_){ return ""; } });
ipcMain.handle("clip-clear-if", async (e,value)=>{ if(!_fromMain(e)||typeof value!=="string")return false; try{ const cb=require("electron").clipboard; if(cb.readText()===value){ cb.clear(); return true; } }catch(_){} return false; });
ipcMain.handle("hotkey-toggle", (e, enabled)=>{ if(!_fromMain(e))return {ok:false,enabled:false}; _hkEnabled=!!enabled; if(_hkEnabled){ _hkRegister(); } else { _hkUnregister(); } try{ if(mainWin) mainWin.webContents.send("hotkey-status",{ok:_hkOk,combo:_hkCombo,enabled:_hkEnabled}); }catch(_){} return {ok:_hkOk,enabled:_hkEnabled,combo:_hkCombo}; });
ipcMain.handle("hotkeys-update",(e,value)=>{if(!_fromMain(e))return {ok:false,hotkeys:Object.assign({},_runtimeHotkeys)};const hotkeys=_applyHotkeys(value);try{if(mainWin)mainWin.webContents.send("hotkey-status",{ok:_hkOk,combo:_hkCombo,enabled:_hkEnabled});}catch(_){}return {ok:true,registered:_hkOk,hotkeys:hotkeys};});
ipcMain.on("hotkey-capture",(e,active)=>{if(!_fromMain(e))return;_hotkeyCapture=!!active;if(_hotkeyCapture)_hkUnregister();else _hkRegister();});
ipcMain.handle("set-autostart", (e, enabled)=>{ if(!_fromMain(e))return false; try{ app.setLoginItemSettings({openAtLogin:!!enabled}); }catch(_){} try{ return app.getLoginItemSettings().openAtLogin; }catch(_){ return !!enabled; } });
ipcMain.handle("ext-dir", (e)=> _fromMain(e)?EXTENSION_DIR:"");
ipcMain.handle("ext-open", (e)=>{ if(!_fromMain(e))return false; try{ syncBrowserExtension(); require("electron").shell.openPath(EXTENSION_DIR); return true; }catch(_){ return false; } });
ipcMain.handle("media-assets",(e)=>_fromMain(e)?animationAssets():{});
ipcMain.handle("media-open",async(e,kind)=>{if(!_fromMain(e))return false;const folder=kind==="intros"?BOOT_DIR:kind==="animations"?ANIMATION_DIR:"";if(!folder)return false;try{fs.mkdirSync(folder,{recursive:true});const error=await shell.openPath(folder);return !error;}catch(_){return false;}});
ipcMain.on("show-notif", (e, data)=>{ if(!_fromMain(e))return; try{ const {Notification:nN}=require('electron'); const n=new nN({title:String(data&&data.title||'S.I.R').slice(0,100), body:String(data&&data.body||'').slice(0,500), silent:true}); n.show(); }catch(er){ try{console.error('[sinrad] notif:',er.message);}catch(_){} } });

const activeScans = new Map();
ipcMain.handle("fs-home", (e)=> _fromMain(e)?app.getPath("home"):"");
ipcMain.on("fs-scan", (e, payload)=>{
  if(!_fromMain(e)||!payload||typeof payload!=="object") return;
  const win = BrowserWindow.fromWebContents(e.sender);
  const id = payload && payload.id;
  const ctrl = scanFolders(
    (payload.roots && payload.roots.length) ? payload.roots : [app.getPath("home")],
    { query: payload.query || "", maxDepth: payload.maxDepth || 4, skipHidden: payload.skipHidden !== false, cap: payload.cap || 300 },
    {
      onChunk: (items)=>{ if(win && !win.isDestroyed()) win.webContents.send("fs-scan-chunk", { id: id, items: items }); },
      onDone: (info)=>{ activeScans.delete(id); if(win && !win.isDestroyed()) win.webContents.send("fs-scan-done", { id: id, truncated: !!info.truncated }); },
      shouldAbort: ()=> !win || win.isDestroyed()
    }
  );
  activeScans.set(id, ctrl);
});
ipcMain.on("fs-scan-cancel", (e, payload)=>{ if(!_fromMain(e))return; const c = activeScans.get(payload && payload.id); if(c){ c.abort(); activeScans.delete(payload && payload.id); } });

/* ===================== updater: GitHub latest for check, electron-updater for install ===================== */
const https = require("https");
const UPD_OWNER = "SinSeeker0";
const UPD_REPO  = "sinrad";
const UPD_API   = "https://api.github.com/repos/" + UPD_OWNER + "/" + UPD_REPO + "/releases/latest";
const UPD_PAGE  = "https://github.com/" + UPD_OWNER + "/" + UPD_REPO + "/releases/latest";
function updVerTuple(v){ const p=String(v==null?"":v).replace(/^v/i,"").split("."); const o=[]; for(let i=0;i<3;i++){ o.push(parseInt(p[i],10)||0); } return o; }
function updCmp(a,b){ for(let i=0;i<3;i++){ if(a[i]>b[i])return 1; if(a[i]<b[i])return -1; } return 0; }
function updStrip(v){ return String(v==null?"":v).replace(/^v/i,""); }
function updGetJSON(url){ return new Promise(function(res,rej){ const u=new URL(url); const req=https.get({hostname:u.hostname,path:u.pathname+u.search,headers:{"User-Agent":"S.I.R-updater","Accept":"application/vnd.github+json"}},function(r){ if(r.statusCode>=300&&r.statusCode<400&&r.headers.location){ r.resume(); updGetJSON(r.headers.location).then(res,rej); return; } if(r.statusCode!==200){ r.resume(); rej(new Error("GitHub HTTP "+r.statusCode)); return; } let d=""; r.on("data",function(c){d+=c;}); r.on("end",function(){ try{res(JSON.parse(d));}catch(e){rej(e);} }); }); req.on("error",rej); req.setTimeout(12000,function(){req.destroy(new Error("timeout"));}); }); }
function updPickAsset(assets){
  const plat=process.platform;
  const low=function(n){return String(n||"").toLowerCase();};
  if(plat==="win32"){
    for(const a of assets){ const n=low(a.name); if(n.indexOf("setup")>=0 && n.slice(-4)===".exe") return a; }
    for(const a of assets){ if(low(a.name).slice(-4)===".exe") return a; }
    return null;
  }
  if(plat==="linux"){
    for(const a of assets){ if(low(a.name).indexOf(".appimage")>=0) return a; }
    return null;
  }
  return null;
}
ipcMain.handle("app-version", (e)=> _fromMain(e)?app.getVersion():"");
ipcMain.handle("update-check", async function(e, rendererVer){
  if(!_fromMain(e)) return {ok:false,error:"unauthorized"};
  const cur=updStrip(app.getVersion()||rendererVer||"0.0.0");
  try{
    const rel=await updGetJSON(UPD_API);
    const tag=updStrip(rel.tag_name||rel.name||"");
    if(!tag) return {ok:false, error:"No release tag on GitHub", current:cur, platform:process.platform};
    const available=updCmp(updVerTuple(tag),updVerTuple(cur))>0;
    const asset=updPickAsset(rel.assets||[]);
    return {
      ok:true, available:available, latest:tag, current:cur,
      notes:String(rel.body||"").trim(), date:String(rel.published_at||"").slice(0,10),
      platform:process.platform,
      asset: asset?{url:asset.browser_download_url, name:asset.name, size:asset.size||0}:null,
      canAuto: !!(autoUpdater && app.isPackaged),
      page: UPD_PAGE
    };
  }catch(err){
    return {ok:false, error:String(err&&err.message||err), current:cur, platform:process.platform};
  }
});
ipcMain.handle("update-download", async function(e, payload){
  if(!_fromMain(e)) return {manual:false,error:"unauthorized"};
  if(autoUpdater && app.isPackaged){
    const onProg=function(p){ if(mainWin&&!mainWin.isDestroyed()){ mainWin.webContents.send("update-progress", {got:p.transferred||0, total:p.total||0, percent:p.percent||0}); } };
    autoUpdater.on("download-progress", onProg);
    try{
      const info=await autoUpdater.checkForUpdates();
      if(info && info.updateInfo){ await autoUpdater.downloadUpdate(); return {temp:true}; }
    }catch(err){
      try{ console.error("[sinrad] update download:", err&&err.message); }catch(_){}
    }finally{
      try{ autoUpdater.removeListener("download-progress", onProg); }catch(_){}
    }
  }
  try{ shell.openExternal(UPD_PAGE); }catch(_){}
  return {manual:true};
});
ipcMain.handle("update-install", async function(e){
  if(!_fromMain(e)) return {ok:false,error:"unauthorized"};
  if(autoUpdater && app.isPackaged){
    try{ autoUpdater.quitAndInstall(true,true); return {ok:true,silent:true}; }catch(err){ try{ console.error("[sinrad] update install:", err&&err.message); }catch(_){} }
  }
  try{ shell.openExternal(UPD_PAGE); }catch(_){}
  return {manual:true};
});
