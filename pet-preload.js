"use strict";

const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
  openPath: (p) => ipcRenderer.invoke("open-path", p),
  petDragStart: (off) => ipcRenderer.send("pet-drag-start", off),
  petDragEnd: () => ipcRenderer.send("pet-drag-end"),
  setMouseIgnore: (value, options) => ipcRenderer.send("set-mouse-ignore", value, options),
  petNav: (moduleName) => ipcRenderer.send("pet-nav", moduleName),
  petPin: () => ipcRenderer.send("pet-pin"),
  petRecents: () => ipcRenderer.invoke("pet-recents"),
  onRecentFolders: (callback) => ipcRenderer.on("recent-folders-update", (_event, value) => callback(value)),
  killArm: (minutes) => ipcRenderer.invoke("kill-arm", minutes),
  killCancel: () => ipcRenderer.invoke("kill-cancel"),
  killToggle: (minutes) => ipcRenderer.invoke("kill-toggle", minutes),
  killStatus: () => ipcRenderer.invoke("kill-status"),
  onKillStatus: (callback) => ipcRenderer.on("kill-status", (_event, value) => callback(value))
});
