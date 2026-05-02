import { contextBridge, ipcRenderer } from "electron";
contextBridge.exposeInMainWorld("beelite", {
  versions: () => ipcRenderer.invoke("app:versions"),
  storageStats: () => ipcRenderer.invoke("storage:stats"),
  listImportJobs: () => ipcRenderer.invoke("imports:listJobs"),
  listSources: () => ipcRenderer.invoke("imports:listSources"),
  importChatGpt: () => ipcRenderer.invoke("imports:chatgpt"),
  importBookmarks: () => ipcRenderer.invoke("imports:bookmarks"),
  loadWorkspace: () => ipcRenderer.invoke("workspace:load"),
  getLlmSettings: () => ipcRenderer.invoke("llm:getSettings"),
  setLlmProvider: (payload) => ipcRenderer.invoke("llm:setProvider", payload),
  getResearchSettings: () => ipcRenderer.invoke("research:getSettings"),
  setResearchSettings: (payload) => ipcRenderer.invoke("research:setSettings", payload),
  researchSearch: (params) => ipcRenderer.invoke("research:search", params),
  researchFetchPage: (params) => ipcRenderer.invoke("research:fetchPage", params),
  openExternal: (url) => ipcRenderer.invoke("app:openExternal", url)
});
