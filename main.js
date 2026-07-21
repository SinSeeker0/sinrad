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
    frame:false, backgroundColor:"#060608", title:"Sinrad",
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
    width:200, height:220, x:wa.x+24, y:wa.y+wa.height-240,
    transparent:true, frame:false, alwaysOnTop:true, resizable:false,
    skipTaskbar:true, hasShadow:false, focusable:false, fullscreenable:false,
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
ipcMain.on("pet-pin", ()=>{ hidePet(); if(mainWin) mainWin.webContents.send("norma-dock"); });
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
