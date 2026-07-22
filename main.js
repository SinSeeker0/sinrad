// Sinrad — Electron main process (main window + floating desktop "pet" window)
const { app, BrowserWindow, ipcMain, shell, screen } = require("electron");
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
    frame:false, backgroundColor:"#060608", title:"S.I.R", icon:path.join(__dirname,"icon.png"),
    webPreferences:{ preload:path.join(__dirname,"preload.js"), contextIsolation:true, nodeIntegration:false, sandbox:false }
  });
  mainWin.loadFile(path.join(__dirname,"index.html"));
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

app.whenReady().then(()=>{
  createWindow();
  app.on("activate", ()=>{ if(BrowserWindow.getAllWindows().length===0) createWindow(); });
});
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
ipcMain.on("pet-nav", (e,mod)=>{ if(mainWin){ mainWin.webContents.send("norma-nav", mod); if(mainWin.isMinimized()) mainWin.restore(); } });
ipcMain.on("pet-pin", ()=>{ hidePet(); if(mainWin){ if(mainWin.isMinimized()) mainWin.restore(); mainWin.show(); mainWin.moveTop(); mainWin.webContents.send("norma-dock"); } });
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

