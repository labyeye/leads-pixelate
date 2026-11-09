const { contextBridge } = require("electron");

// Lets the web app know it runs inside the desktop shell.
contextBridge.exposeInMainWorld("desktop", {
  isDesktop: true,
  platform: process.platform, // "darwin" | "win32"
});
