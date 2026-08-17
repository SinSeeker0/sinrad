"use strict";

const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
  bootDone: () => ipcRenderer.send("boot-done"),
  onBootVideo: (callback) => ipcRenderer.once("boot-video", (_event, value) => callback(value))
});
