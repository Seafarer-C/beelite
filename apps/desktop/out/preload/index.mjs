import { contextBridge, ipcRenderer } from "electron";
contextBridge.exposeInMainWorld("beelite", {
  versions: () => ipcRenderer.invoke("app:versions")
});
