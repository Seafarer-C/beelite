import type {
  LlmSetProviderPayload,
  ResearchFetchPageParams,
  ResearchSearchParams,
  ResearchSetSettingsPayload
} from "@beelite/shared";
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
  setLlmProvider: (payload: LlmSetProviderPayload) => ipcRenderer.invoke("llm:setProvider", payload),
  getResearchSettings: () => ipcRenderer.invoke("research:getSettings"),
  setResearchSettings: (payload: ResearchSetSettingsPayload) =>
    ipcRenderer.invoke("research:setSettings", payload),
  researchSearch: (params: ResearchSearchParams) => ipcRenderer.invoke("research:search", params),
  researchFetchPage: (params: ResearchFetchPageParams) => ipcRenderer.invoke("research:fetchPage", params),
  openExternal: (url: string) => ipcRenderer.invoke("app:openExternal", url)
});
