// Sinrad — Electron main process (main window + floating desktop "pet" window)
const { app, BrowserWindow, ipcMain, shell, screen, safeStorage } = require("electron");
app.commandLine.appendSwitch("autoplay-policy","no-user-gesture-required");
const PROTOCOL="sinrad"; app.setAsDefaultProtocolClient(PROTOCOL);
app.setAppUserModelId("S.I.R — Personal Command Center");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const scanFolders = require("./scan.js");
const { normalizeHttpUrl, isAllowedExtensionOrigin, isPathInside } = require("./lib/security.js");
const { validDirectories, listScreenshotFiles } = require("./lib/screenshots.js");
const { thumbnailKey, pruneThumbnailCache } = require("./lib/thumbnail-cache.js");
let autoUpdater=null; try{ autoUpdater=require("electron-updater").autoUpdater; }catch(_e){ try{ console.error("[sinrad] electron-updater unavailable:", _e&&_e.message); }catch(_){} }

const DATA_DIR = app.getPath("userData");
const DATA_FILE = path.join(DATA_DIR,"sinrad-data.json");
const DATA_BACKUP = DATA_FILE+".bak";
const DATA_TMP = DATA_FILE+".sinrad-tmp";
const EXTENSION_SOURCE = path.join(__dirname,"extension").replace("app.asar","app.asar.unpacked");
const EXTENSION_DIR = path.join(DATA_DIR,"browser-extension");
const THUMBNAIL_DIR = path.join(DATA_DIR,"thumbnail-cache");
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
function syncBrowserExtension(){
  try{
    fs.mkdirSync(EXTENSION_DIR,{recursive:true,mode:0o700});
    fs.readdirSync(EXTENSION_SOURCE,{withFileTypes:true}).forEach(function(entry){
      if(!entry.isFile()) return;
      const source=path.join(EXTENSION_SOURCE,entry.name);
      const destination=path.join(EXTENSION_DIR,entry.name);
      const incoming=fs.readFileSync(source);
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
    frame:false, show:false, backgroundColor:"#060608", title:"S.I.R", icon:path.join(__dirname,"icon.png"),
    webPreferences:{ preload:path.join(__dirname,"preload.js"), contextIsolation:true, nodeIntegration:false, sandbox:true, webSecurity:true }
  });
  lockNavigation(mainWin,"index.html");
  mainWin.loadFile(path.join(__dirname,"index.html"));
  // Auto-undock pet if setting is enabled; also flush parks queued during boot
  mainWin.webContents.on("did-finish-load", function(){
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
    width:320, height:390, x:wa.x+24, y:wa.y+wa.height-430,
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
function _sendPark(data){
  try{
    if(mainWin && !mainWin.isDestroyed()){ mainWin.webContents.send('protocol-park', data); return true; }
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
app.on("open-url",function(event,url){ event.preventDefault(); _handleProtocolUrl(url); });

// --- authenticated localhost bridge for the browser extension ---
const LOCAL_PORT = 47821;
const LOCAL_TOKEN = crypto.randomBytes(32).toString("hex");
let _localServer = null;
let _localHits=[];
function _localJson(res,status,data,origin){ if(origin) res.setHeader("Access-Control-Allow-Origin",origin); res.setHeader("Vary","Origin"); res.writeHead(status,{"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store"}); res.end(JSON.stringify(data)); }
function _startLocalServer(){
  if(_localServer) return;
  try{
    const http = require('http');
    _localServer = http.createServer(function(req, res){
      const origin=String(req.headers.origin||"");
      if(!isAllowedExtensionOrigin(origin)){ _localJson(res,403,{ok:false,error:"extension origin required"}); return; }
      res.setHeader("Access-Control-Allow-Origin",origin); res.setHeader("Vary","Origin");
      res.setHeader("Access-Control-Allow-Methods","GET,POST,OPTIONS");
      res.setHeader("Access-Control-Allow-Headers","Content-Type,X-Sinrad-Token");
      if(req.method==="OPTIONS"){ res.writeHead(204); res.end(); return; }
      const u=new URL(req.url,"http://localhost");
      if(req.method==="GET" && u.pathname==="/token"){ _localJson(res,200,{ok:true,token:LOCAL_TOKEN},origin); return; }
      if(req.method!=="POST" || u.pathname!=="/park"){ _localJson(res,404,{ok:false,error:"not found"},origin); return; }
      if(req.headers["x-sinrad-token"]!==LOCAL_TOKEN){ _localJson(res,401,{ok:false,error:"invalid token"},origin); return; }
      const now=Date.now(); _localHits=_localHits.filter(function(t){return now-t<60000;});
      if(_localHits.length>=120){ _localJson(res,429,{ok:false,error:"rate limit"},origin); return; }
      _localHits.push(now);
      let body=""; let tooLarge=false;
      req.on("data",function(chunk){ body+=chunk; if(Buffer.byteLength(body,"utf8")>65536){ tooLarge=true; req.destroy(); } });
      req.on("end",function(){
        if(tooLarge){ _localJson(res,413,{ok:false,error:"request too large"},origin); return; }
        try{
          const data=JSON.parse(body||"{}"); const linkUrl=normalizeHttpUrl(data.url); const title=String(data.title||"").slice(0,500); const lot=data.lot===true;
          if(!linkUrl){ _localJson(res,400,{ok:false,error:"http(s) URL required"},origin); return; }
          _sendPark({url:linkUrl,title:title,lot:lot}); _localJson(res,200,{ok:true},origin);
        }catch(err){ _localJson(res,400,{ok:false,error:"invalid JSON"},origin); }
      });
    });
    _localServer.on('error', function(e){ console.error('[sinrad] local server port '+LOCAL_PORT+' unavailable:', e.message); _localServer=null; });
    _localServer.listen(LOCAL_PORT, '127.0.0.1');
  }catch(e){ console.error('[sinrad] local server failed:', e.message); }
}
// --- global hotkey (module scope so IPC handler can toggle at runtime) ---
const {globalShortcut}=require('electron'); const HK_COMBO='CommandOrControl+Alt+P';
function _hkCb(){ try{ const t=require('electron').clipboard.readText(); if(mainWin){ mainWin.webContents.send('hotkey-park', t); if(mainWin.isMinimized())mainWin.restore(); mainWin.show(); mainWin.focus(); } }catch(_){} }
let _hkOk=false; let _hkEnabled=true;
function _hkRegister(){ try{ if(_hkEnabled&&!_hkOk){ _hkOk=!!globalShortcut.register(HK_COMBO, _hkCb); } }catch(_){} }
function _hkUnregister(){ try{ if(_hkOk){ globalShortcut.unregister(HK_COMBO); _hkOk=false; } }catch(_){} }
app.whenReady().then(()=>{
  if(!_gotLock) return;
  migrateLegacyStore();
  syncBrowserExtension();
  fs.promises.mkdir(THUMBNAIL_DIR,{recursive:true,mode:0o700}).then(function(){ return pruneThumbnailCache(THUMBNAIL_DIR,{maxFiles:1500,maxBytes:256*1024*1024}); }).catch(function(){});
  try{ _killRestore(); }catch(_){}
  syncBoot();
  try{ if(autoUpdater){ autoUpdater.autoDownload=false; autoUpdater.autoInstallOnAppQuit=true; autoUpdater.allowDowngrade=false; autoUpdater.allowPrerelease=false; try{ autoUpdater.setFeedURL({provider:"github",owner:"SinSeeker0",repo:"sinrad"}); }catch(_){} autoUpdater.on("error", function(e){ try{ console.error("[sinrad] autoUpdater:", e&&e.message); }catch(_){} }); } }catch(_e){ try{ console.error("[sinrad] autoUpdater config failed:", _e&&_e.message); }catch(_){} }
  const vid=pickBootVideo();
  const _st=readStore(); const _introOn=!(_st&&_st.settings&&_st.settings.introEnabled===false);
  if(vid && _introOn){ hasSplash=true; createSplash(vid); if(!splashWin) hasSplash=false; }
  createWindow();
  _startLocalServer();
  var _protoArg=process.argv.find(function(a){return a.startsWith(PROTOCOL+"://");}); if(_protoArg){ mainWin.webContents.once("did-finish-load",function(){ _handleProtocolUrl(_protoArg); }); }
  try{ mainWin.webContents.once('did-finish-load', function(){ try{ mainWin.webContents.send('data-path', DATA_FILE); }catch(_){} }); }catch(_){}
  _hkEnabled=!(_st&&_st.settings&&_st.settings.hotkeyEnabled===false); if(_hkEnabled){ _hkRegister(); } try{ mainWin.webContents.once('did-finish-load', function(){ try{ mainWin.webContents.send('hotkey-status',{ok:_hkOk,combo:'Ctrl+Alt+P',enabled:_hkEnabled}); }catch(_){} }); }catch(_){}
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
const { nativeImage, clipboard, dialog } = require("electron");
const SHOT_EXTS = { ".png":1, ".jpg":1, ".jpeg":1, ".webp":1, ".gif":1, ".bmp":1, ".jfif":1 };
const _thumbnailInflight=new Map();
let _thumbnailWrites=0;
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
      try{ const bytes=await fs.promises.readFile(cached); return "data:image/jpeg;base64,"+bytes.toString("base64"); }catch(_){}
      let img=null;
      try{ img=await nativeImage.createThumbnailFromPath(resolved,{ width:360, height:220 }); }catch(_){}
      if(!img||img.isEmpty()){ img=nativeImage.createFromPath(resolved); if(img&&!img.isEmpty()) img=img.resize({ width:360, quality:"good" }); }
      if(!img||img.isEmpty()) return "";
      const bytes=img.toJPEG(78);
      await fs.promises.writeFile(cached,bytes,{mode:0o600});
      if(++_thumbnailWrites%50===1) pruneThumbnailCache(THUMBNAIL_DIR,{maxFiles:1500,maxBytes:256*1024*1024}).catch(function(){});
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

const BGM_DIR = path.join(app.getPath("userData"),"bgm");
const BUNDLED_BGM = path.join(__dirname,"bgm");
function syncBundled(){ try{ fs.mkdirSync(BGM_DIR,{recursive:true}); }catch(_){} const exts=[".mp3",".ogg",".wav",".m4a",".flac",".webm",".opus"]; try{ fs.readdirSync(BUNDLED_BGM).forEach(function(f){ if(exts.indexOf(path.extname(f).toLowerCase())<0) return; const dest=path.join(BGM_DIR,f); if(!fs.existsSync(dest)){ try{ fs.writeFileSync(dest, fs.readFileSync(path.join(BUNDLED_BGM,f))); }catch(_){} } }); }catch(_){} }
function scanBgm(){ try{ fs.mkdirSync(BGM_DIR,{recursive:true}); }catch(_){} const exts=[".mp3",".ogg",".wav",".m4a",".flac",".webm",".opus"]; let out=[]; try{ out=fs.readdirSync(BGM_DIR).filter(function(f){ return exts.indexOf(path.extname(f).toLowerCase())>=0; }).map(function(f){ return {name:f, path:path.join(BGM_DIR,f)}; }); }catch(_){} return out; }
ipcMain.on("music-request",(e)=>{ if(!_fromMain(e))return; syncBundled(); mainWin.webContents.send("music-list", {files:scanBgm(), dir:BGM_DIR}); });
ipcMain.on("music-cmd",(e,c)=>{ if(_fromMain(e)&&mainWin&&["toggle","next","prev"].indexOf(c)>=0) mainWin.webContents.send("music-cmd", c); });
ipcMain.handle("music-read", async (e,p)=>{ try{ if(!_fromMain(e)||typeof p!=="string"||!p) return Buffer.alloc(0); const resolved=path.resolve(p); const root=path.resolve(BGM_DIR)+path.sep; if(resolved!==path.resolve(BGM_DIR) && resolved.indexOf(root)!==0) return Buffer.alloc(0); return await fs.promises.readFile(resolved); }catch(_){ return Buffer.alloc(0); } });
ipcMain.handle("clip-read", async (e) => { if(!_fromMain(e))return ""; try { return require("electron").clipboard.readText(); } catch(_){ return ""; } });
ipcMain.handle("clip-clear-if", async (e,value)=>{ if(!_fromMain(e)||typeof value!=="string")return false; try{ const cb=require("electron").clipboard; if(cb.readText()===value){ cb.clear(); return true; } }catch(_){} return false; });
ipcMain.handle("hotkey-toggle", (e, enabled)=>{ if(!_fromMain(e))return {ok:false,enabled:false}; _hkEnabled=!!enabled; if(_hkEnabled){ _hkRegister(); } else { _hkUnregister(); } try{ if(mainWin) mainWin.webContents.send("hotkey-status",{ok:_hkOk,combo:"Ctrl+Alt+P",enabled:_hkEnabled}); }catch(_){} return {ok:_hkOk, enabled:_hkEnabled}; });
ipcMain.handle("set-autostart", (e, enabled)=>{ if(!_fromMain(e))return false; try{ app.setLoginItemSettings({openAtLogin:!!enabled}); }catch(_){} try{ return app.getLoginItemSettings().openAtLogin; }catch(_){ return !!enabled; } });
ipcMain.handle("ext-dir", (e)=> _fromMain(e)?EXTENSION_DIR:"");
ipcMain.handle("ext-open", (e)=>{ if(!_fromMain(e))return false; try{ syncBrowserExtension(); require("electron").shell.openPath(EXTENSION_DIR); return true; }catch(_){ return false; } });
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
    try{ autoUpdater.quitAndInstall(false,true); return {ok:true}; }catch(err){ try{ console.error("[sinrad] update install:", err&&err.message); }catch(_){} }
  }
  try{ shell.openExternal(UPD_PAGE); }catch(_){}
  return {manual:true};
});
