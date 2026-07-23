// Sinrad — Electron main process (main window + floating desktop "pet" window)
const { app, BrowserWindow, ipcMain, shell, screen } = require("electron");
app.commandLine.appendSwitch("autoplay-policy","no-user-gesture-required");
const path = require("path");
const fs = require("fs");
const scanFolders = require("./scan.js");

const DATA_FILE = path.join(app.getPath("userData"), "sinrad-data.json");
function readStore(){ try{ if(fs.existsSync(DATA_FILE)) return JSON.parse(fs.readFileSync(DATA_FILE,"utf8")); }catch(e){ console.error("[sinrad] read store failed:", e.message); } return null; }
function writeStore(data){ try{ fs.writeFileSync(DATA_FILE, JSON.stringify(data,null,2), "utf8"); return true; }catch(e){ console.error("[sinrad] write store failed:", e.message); return false; } }

let mainWin = null;
let petWin = null;

function createWindow(){
  mainWin = new BrowserWindow({
    width:1280, height:900, minWidth:900, minHeight:640,
    frame:false, show:false, backgroundColor:"#060608", title:"S.I.R", icon:path.join(__dirname,"icon.png"),
    webPreferences:{ preload:path.join(__dirname,"preload.js"), contextIsolation:true, nodeIntegration:false, sandbox:false, webSecurity:false }
  });
  mainWin.loadFile(path.join(__dirname,"index.html"));
  try{ mainWin.webContents.setAudioMuted(true); }catch(e){}   // keep the app silent during the intro video; showMain() un-mutes it
  mainWin.on("closed", ()=>{ mainWin=null; if(petWin){ try{petWin.close();}catch(e){} petWin=null; } });
}

/* ---------- floating desktop pet window ---------- */
function createPet(){
  if(petWin) return petWin;
  const wa = screen.getPrimaryDisplay().workArea;
  petWin = new BrowserWindow({
    width:300, height:200, x:wa.x+24, y:wa.y+wa.height-240,
    transparent:true, frame:false, alwaysOnTop:true, resizable:false,
    skipTaskbar:true, hasShadow:false, focusable:true, fullscreenable:false,
    webPreferences:{ preload:path.join(__dirname,"preload.js"), contextIsolation:true, nodeIntegration:false, sandbox:false, webSecurity:false }
  });
  petWin.setAlwaysOnTop(true, "screen-saver");           // float above everything
  petWin.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen:true });
  petWin.loadFile(path.join(__dirname,"pet.html"));
  // click-through on transparent areas (forward mouse so renderer can toggle)
  petWin.setIgnoreMouseEvents(true, { forward:true });
  petWin.on("closed", ()=>{ petWin=null; });
  return petWin;
}
let petTopTimer=null;
function assertPetTop(){ if(petWin && !petWin.isDestroyed() && petWin.isVisible()){ try{ petWin.setAlwaysOnTop(true,"screen-saver"); petWin.moveTop(); }catch(e){} } }
function showPet(){ const w=createPet(); w.show(); assertPetTop(); if(petTopTimer) clearInterval(petTopTimer); petTopTimer=setInterval(assertPetTop,2500); }
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
function createSplash(vid){ try{ splashWin=new BrowserWindow({ width:720, height:408, frame:false, transparent:false, alwaysOnTop:true, skipTaskbar:true, resizable:false, show:true, backgroundColor:"#000000", webPreferences:{ preload:path.join(__dirname,"preload.js"), contextIsolation:true, nodeIntegration:false, sandbox:false, webSecurity:false } }); splashWin.setMenuBarVisibility(false); splashWin.loadFile(path.join(__dirname,"splash.html")); splashWin.webContents.once("did-finish-load",function(){ try{ splashWin.webContents.executeJavaScript("window.__BOOT_VIDEO="+JSON.stringify(vid)+"; if(window.__bootGotVideo) window.__bootGotVideo();"); }catch(e){} }); splashWin.on("closed",function(){ splashWin=null; finishBoot(); }); try{ splashWin.webContents.on("render-process-gone",function(){ finishBoot(); }); splashWin.webContents.on("crashed",function(){ finishBoot(); }); }catch(e){} }catch(e){ splashWin=null; } }
/* Boot flow: the splash video plays FIRST (to completion or until skipped).
   The main window loads hidden in the background and only appears once the
   video is done, so the user always gets to see the boot video. */
let mainReady=false, bootFinished=false, hasSplash=false;
function showMain(){ if(mainWin && !mainWin.isDestroyed()){ try{ mainWin.webContents.setAudioMuted(false); }catch(e){} mainWin.show(); try{ mainWin.focus(); }catch(e){} } }
function finishBoot(){ if(bootFinished) return; bootFinished=true; try{ if(splashWin && !splashWin.isDestroyed()) splashWin.close(); }catch(e){} splashWin=null; if(mainReady) showMain(); }
app.whenReady().then(()=>{
  syncBoot();
  const vid=pickBootVideo();
  const _st=readStore(); const _introOn=!(_st&&_st.settings&&_st.settings.introEnabled===false);
  if(vid && _introOn){ hasSplash=true; createSplash(vid); }
  createWindow();
  mainWin.once("ready-to-show",()=>{ mainReady=true; if(!hasSplash || bootFinished){ bootFinished=true; showMain(); } });
  // pure anti-brick guard: never stay stuck on the splash forever (10 min cap)
  setTimeout(finishBoot, 600000);
  app.on("activate", ()=>{ if(BrowserWindow.getAllWindows().length===0) createWindow(); });
});
ipcMain.on("boot-done", ()=>finishBoot());
app.on("window-all-closed", ()=>{ if(process.platform!=="darwin") app.quit(); });

/* ---------- IPC: main window controls ---------- */
ipcMain.on("win-min",  (e)=>{ const w=BrowserWindow.fromWebContents(e.sender); if(w) w.minimize(); });
ipcMain.on("win-max",  (e)=>{ const w=BrowserWindow.fromWebContents(e.sender); if(w){ w.isMaximized()?w.unmaximize():w.maximize(); } });
ipcMain.on("win-close",(e)=>{ const w=BrowserWindow.fromWebContents(e.sender); if(w) w.close(); });

/* ---------- IPC: open urls / local apps ---------- */
ipcMain.on("shell-open", (e,url)=>{ if(typeof url==="string"&&url) shell.openExternal(url); });
ipcMain.handle("open-path", async (e,p)=>{ if(typeof p!=="string"||!p) return false; try{ await shell.openPath(p); return true; }catch(err){ return false; } });

/* ---------- IPC: store ---------- */
ipcMain.handle("store-load", ()=>readStore());
ipcMain.handle("store-save", (e,data)=>writeStore(data));

/* ---------- IPC: pet window ---------- */
ipcMain.on("pet-show", ()=>showPet());
ipcMain.on("pet-hide", ()=>hidePet());
ipcMain.on("pet-drag-start", (e,off)=>startDrag(off));
ipcMain.on("pet-drag-end",   ()=>stopDrag());
ipcMain.on("set-mouse-ignore", (e,b,opts)=>{ const w=BrowserWindow.fromWebContents(e.sender); if(w) w.setIgnoreMouseEvents(!!b, opts||{}); });
ipcMain.on("pet-nav", (e,mod)=>{ if(mainWin){ mainWin.webContents.send("norma-nav", mod); if(mainWin.isMinimized()) mainWin.restore(); mainWin.show(); mainWin.moveTop(); mainWin.focus(); } });
ipcMain.on("pet-pin", ()=>{ hidePet(); if(mainWin){ if(mainWin.isMinimized()) mainWin.restore(); mainWin.show(); mainWin.moveTop(); mainWin.focus(); mainWin.webContents.send("norma-dock"); } });
const BGM_DIR = path.join(app.getPath("userData"),"bgm");
const BUNDLED_BGM = path.join(__dirname,"bgm");
function syncBundled(){ try{ fs.mkdirSync(BGM_DIR,{recursive:true}); }catch(_){} const exts=[".mp3",".ogg",".wav",".m4a",".flac",".webm",".opus"]; try{ fs.readdirSync(BUNDLED_BGM).forEach(function(f){ if(exts.indexOf(path.extname(f).toLowerCase())<0) return; const dest=path.join(BGM_DIR,f); if(!fs.existsSync(dest)){ try{ fs.writeFileSync(dest, fs.readFileSync(path.join(BUNDLED_BGM,f))); }catch(_){} } }); }catch(_){} }
function scanBgm(){ try{ fs.mkdirSync(BGM_DIR,{recursive:true}); }catch(_){} const exts=[".mp3",".ogg",".wav",".m4a",".flac",".webm",".opus"]; let out=[]; try{ out=fs.readdirSync(BGM_DIR).filter(function(f){ return exts.indexOf(path.extname(f).toLowerCase())>=0; }).map(function(f){ return {name:f, path:path.join(BGM_DIR,f)}; }); }catch(_){} return out; }
ipcMain.on("music-request",(e)=>{ syncBundled(); const w=BrowserWindow.fromWebContents(e.sender); if(w) w.webContents.send("music-list", {files:scanBgm(), dir:BGM_DIR}); });
ipcMain.on("music-cmd",(e,c)=>{ if(mainWin) mainWin.webContents.send("music-cmd", c); });
ipcMain.handle("music-read", async (e,p)=>{ try{ return await fs.promises.readFile(p); }catch(_){ return Buffer.alloc(0); } });

const activeScans = new Map();
ipcMain.handle("fs-home", ()=> app.getPath("home"));
ipcMain.on("fs-scan", (e, payload)=>{
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
ipcMain.on("fs-scan-cancel", (e, payload)=>{ const c = activeScans.get(payload && payload.id); if(c){ c.abort(); activeScans.delete(payload && payload.id); } });

/* ===================== auto-updater (GitHub Releases, no installer needed) ===================== */
const https = require("https");
const UPD_OWNER = "SinSeeker0";
const UPD_REPO  = "sinrad";
const UPD_API   = "https://api.github.com/repos/" + UPD_OWNER + "/" + UPD_REPO + "/releases/latest";
const UPD_PAGE  = "https://github.com/" + UPD_OWNER + "/" + UPD_REPO + "/releases/latest";
function updVerTuple(v){ const p=String(v==null?"":v).split("."); const o=[]; for(let i=0;i<3;i++){ o.push(parseInt(p[i],10)||0); } return o; }
function updCmp(a,b){ for(let i=0;i<3;i++){ if(a[i]>b[i])return 1; if(a[i]<b[i])return -1; } return 0; }
function updGetJSON(url){ return new Promise(function(res,rej){ const u=new URL(url); const req=https.get({hostname:u.hostname,path:u.pathname+u.search,headers:{"User-Agent":"S.I.R-updater","Accept":"application/vnd.github+json"}},function(r){ let d=""; r.on("data",function(c){d+=c;}); r.on("end",function(){ try{res(JSON.parse(d));}catch(e){rej(e);} }); }); req.on("error",rej); req.setTimeout(15000,function(){req.destroy(new Error("timeout"));}); }); }
function updGetFile(url,dest,onProg){ return new Promise(function(res,rej){ const u=new URL(url); const req=https.get({hostname:u.hostname,path:u.pathname+u.search,headers:{"User-Agent":"S.I.R-updater"}},function(r){ if(r.statusCode>=300&&r.statusCode<400&&r.headers.location){ r.resume(); updGetFile(r.headers.location,dest,onProg).then(res,rej); return; } if(r.statusCode!==200){ r.resume(); rej(new Error("HTTP "+r.statusCode)); return; } const total=parseInt(r.headers["content-length"]||"0",10)||0; let got=0; const out=fs.createWriteStream(dest); r.on("data",function(c){ got+=c.length; if(onProg)onProg(got,total); }); r.pipe(out); out.on("finish",function(){ out.close(function(){ res(dest); }); }); out.on("error",rej); }); req.on("error",rej); req.setTimeout(120000,function(){req.destroy(new Error("timeout"));}); }); }
function updPickAsset(assets,latestVer){
  const plat=process.platform; const cur=String(app.getVersion()||"");
  if(plat==="darwin") return null;
  const low=function(n){return String(n||"").toLowerCase();};
  if(plat==="win32"){
    const base=path.basename(process.execPath);
    if(cur && base.indexOf(cur)>=0){ const guess=base.split(cur).join(latestVer); for(const a of assets){ if(a.name===guess) return a; } }
    for(const a of assets){ const n=low(a.name); if(n.slice(-4)===".exe" && n.indexOf("setup")<0 && n.indexOf("installer")<0 && n.indexOf("nsis")<0) return a; }
    for(const a of assets){ if(low(a.name).slice(-4)===".exe") return a; }
    return null;
  }
  const base=path.basename(process.env.APPIMAGE||process.execPath);
  if(cur && base.indexOf(cur)>=0){ const guess=base.split(cur).join(latestVer); for(const a of assets){ if(a.name===guess) return a; } }
  for(const a of assets){ if(low(a.name).indexOf(".appimage")>=0) return a; }
  return null;
}
ipcMain.handle("update-check", async function(e, currentVer){
  try{
    const rel=await updGetJSON(UPD_API);
    let tag=String(rel.tag_name||""); if(tag.charAt(0)==="v"||tag.charAt(0)==="V") tag=tag.slice(1);
    const cur=String(currentVer||app.getVersion()||"0.0.0");
    const available=updCmp(updVerTuple(tag),updVerTuple(cur))>0;
    const asset=updPickAsset(rel.assets||[], tag);
    return { ok:true, available:available, latest:tag, current:cur, notes:String(rel.body||""), date:String(rel.published_at||"").slice(0,10), platform:process.platform, repoUrl:UPD_PAGE, asset: asset?{name:asset.name,url:asset.browser_download_url,size:asset.size||0}:null };
  }catch(err){ return { ok:false, error:String(err&&err.message||err) }; }
});
let updTemp=null;
ipcMain.handle("update-download", async function(e, payload){
  const url=payload&&payload.url; if(!url) throw new Error("no url");
  const dest=path.join(app.getPath("temp"), "sinrad_update_"+Date.now()+".part"); updTemp=dest;
  const win=BrowserWindow.fromWebContents(e.sender);
  await updGetFile(url, dest, function(got,total){ if(win&&!win.isDestroyed()) win.webContents.send("update-progress",{got:got,total:total}); });
  return { ok:true, temp:dest };
});
ipcMain.handle("update-install", async function(e, tempPath){
  const plat=process.platform; const src=tempPath||updTemp; if(!src) throw new Error("no downloaded file");
  if(plat==="darwin"){ shell.openExternal(UPD_PAGE); return {ok:true, manual:true}; }
  const spawn=require("child_process").spawn;
  if(plat==="win32"){
    const target=process.env.PORTABLE_EXECUTABLE_FILE||process.execPath; const bat=path.join(app.getPath("temp"),"sinrad_update.bat");
    const body=`@echo off\r
:loop\r
ping 127.0.0.1 -n 2 > nul\r
move /Y "${src}" "${target}" > nul 2>&1\r
if errorlevel 1 goto loop\r
start "" "${target}"\r
del "%~f0"\r
`;
    fs.writeFileSync(bat, body);
    const child=spawn("cmd.exe", ["/c", bat], {detached:true, stdio:"ignore", windowsHide:true}); child.unref();
    setTimeout(function(){ app.quit(); }, 300); return {ok:true};
  } else {
    const target=process.env.APPIMAGE||process.execPath; const sh=path.join(app.getPath("temp"),"sinrad_update.sh");
    const body=`#!/bin/sh
sleep 1
mv -f "${src}" "${target}" && chmod +x "${target}"
nohup "${target}" >/dev/null 2>&1 &
`;
    fs.writeFileSync(sh, body); try{ fs.chmodSync(sh, 0o755); }catch(_){}
    const child=spawn("sh", [sh], {detached:true, stdio:"ignore"}); child.unref();
    setTimeout(function(){ app.quit(); }, 300); return {ok:true};
  }
});

