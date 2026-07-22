// Sinrad — preload bridge (safe API surface for the renderer & the pet window)
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
  // window controls
  winMin:   () => ipcRenderer.send("win-min"),
  winMax:   () => ipcRenderer.send("win-max"),
  winClose: () => ipcRenderer.send("win-close"),

  // open things with the OS
  shellOpen: (url) => ipcRenderer.send("shell-open", url),
  openPath:  (p)   => ipcRenderer.invoke("open-path", p),

  // persistent on-disk store
  storeLoad: () => ipcRenderer.invoke("store-load"),
  storeSave: (data) => ipcRenderer.invoke("store-save", data),

  // desktop pet (floating Norma that lives OUTSIDE the app window)
  petShow: () => ipcRenderer.send("pet-show"),
  petHide: () => ipcRenderer.send("pet-hide"),
  petDragStart: (off) => ipcRenderer.send("pet-drag-start", off),
  petDragEnd:   () => ipcRenderer.send("pet-drag-end"),
  setMouseIgnore: (b, opts) => ipcRenderer.send("set-mouse-ignore", b, opts),
  petNav: (mod) => ipcRenderer.send("pet-nav", mod),
  petPin: () => ipcRenderer.send("pet-pin"),

  // main window <- pet / main process
  onNormaDock: (cb) => ipcRenderer.on("norma-dock", () => cb()),
  onNormaNav:  (cb) => ipcRenderer.on("norma-nav", (_, m) => cb(m)),
  fsScan: (o) => ipcRenderer.send("fs-scan", o),
  fsScanCancel: (o) => ipcRenderer.send("fs-scan-cancel", o),
  onFsChunk: (cb) => ipcRenderer.on("fs-scan-chunk", (_, p) => cb(p)),
  onFsDone: (cb) => ipcRenderer.on("fs-scan-done", (_, p) => cb(p)),
  fsHome: () => ipcRenderer.invoke("fs-home"),
  updateCheck: (v) => ipcRenderer.invoke("update-check", v),
  updateDownload: (o) => ipcRenderer.invoke("update-download", o),
  updateInstall: (t) => ipcRenderer.invoke("update-install", t),
  onUpdateProgress: (cb) => ipcRenderer.on("update-progress", (_, p) => cb(p)),
  musicRequest: () => ipcRenderer.send("music-request"),
  onMusicList: (cb) => ipcRenderer.on("music-list", (_, l) => cb(l)),
  musicCmd: (c) => ipcRenderer.send("music-cmd", c),
  onMusicCmd: (cb) => ipcRenderer.on("music-cmd", (_, c) => cb(c))
});
