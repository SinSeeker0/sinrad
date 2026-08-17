// Sinrad — preload bridge (safe API surface for the renderer & the pet window)
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
  // window controls
  winMin:   () => ipcRenderer.send("win-min"),
  winMax:   () => ipcRenderer.send("win-max"),
  winClose: () => ipcRenderer.send("win-close"),

  // boot splash (video plays first, then the app opens)
  bootDone: () => ipcRenderer.send("boot-done"),

  // open things with the OS
  shellOpen: (url) => ipcRenderer.send("shell-open", url),
  openPath:  (p)   => ipcRenderer.invoke("open-path", p),

  // persistent on-disk store
  storeLoad: () => ipcRenderer.invoke("store-load"),
  storeSecurity: () => ipcRenderer.invoke("store-security"),
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
  appVersion: () => ipcRenderer.invoke("app-version"),
  updateCheck: (v) => ipcRenderer.invoke("update-check", v),
  updateDownload: (o) => ipcRenderer.invoke("update-download", o),
  updateInstall: (t) => ipcRenderer.invoke("update-install", t),
  onUpdateProgress: (cb) => ipcRenderer.on("update-progress", (_, p) => cb(p)),
  musicRequest: () => ipcRenderer.send("music-request"),
  onMusicList: (cb) => ipcRenderer.on("music-list", (_, l) => cb(l)),
  musicCmd: (c) => ipcRenderer.send("music-cmd", c),
  onMusicCmd: (cb) => ipcRenderer.on("music-cmd", (_, c) => cb(c)),
  musicRead: (p) => ipcRenderer.invoke("music-read", p),
  clipRead: () => ipcRenderer.invoke("clip-read"),
  clipClearIf: (value) => ipcRenderer.invoke("clip-clear-if", value),
  onHotkeyPark: (cb) => ipcRenderer.on("hotkey-park", (_, t) => cb(t)),
  hotkeyStatus: (cb) => ipcRenderer.on("hotkey-status", (_, mm) => cb(mm)),
  hotkeyToggle: (enabled) => ipcRenderer.invoke("hotkey-toggle", enabled),
  onProtocolPark: (cb) => ipcRenderer.on("protocol-park", (_, data) => cb(data)),
  setAutostart: (enabled) => ipcRenderer.invoke("set-autostart", enabled),
  extDir: () => ipcRenderer.invoke("ext-dir"),
  extOpen: () => ipcRenderer.invoke("ext-open"),
  showNotif: (data) => ipcRenderer.send("show-notif", data),
  dataPath: (cb) => ipcRenderer.on("data-path", (_, pp) => cb(pp)),

  // pet recent / pinned folders
  syncPetRecents: (slots) => ipcRenderer.send("sync-pet-recents", slots),
  petRecents: () => ipcRenderer.invoke("pet-recents"),
  onRecentFolders: (cb) => ipcRenderer.on("recent-folders-update", (_, list) => cb(list)),
  onRecordRecentFolder: (cb) => ipcRenderer.on("record-recent-folder", (_, info) => cb(info)),
  onAppFocus: (cb) => ipcRenderer.on("app-focus", () => cb()),

  // screenshot library
  shotsScan: (roots) => ipcRenderer.invoke("shots-scan", roots),
  shotsDefaults: () => ipcRenderer.invoke("shots-defaults"),
  shotsPickFolder: () => ipcRenderer.invoke("shots-pick-folder"),
  shotsThumb: (p) => ipcRenderer.invoke("shots-thumb", p),
  shotsRead: (p) => ipcRenderer.invoke("shots-read", p),
  shotsReveal: (p) => ipcRenderer.invoke("shots-reveal", p),
  shotsLookup: (p) => ipcRenderer.invoke("shots-lookup", p),
  shotsOpen: (p) => ipcRenderer.invoke("shots-open", p),
  shotsCopy: (p) => ipcRenderer.invoke("shots-copy", p),

  killArm: (mins) => ipcRenderer.invoke("kill-arm", mins),
  killCancel: () => ipcRenderer.invoke("kill-cancel"),
  killToggle: (mins) => ipcRenderer.invoke("kill-toggle", mins),
  killStatus: () => ipcRenderer.invoke("kill-status"),
  killAsk: () => ipcRenderer.send("kill-ask"),
  onKillStatus: (cb) => ipcRenderer.on("kill-status", (_, s) => cb(s)),
  onKillAsk: (cb) => ipcRenderer.on("kill-ask", () => cb())
});
