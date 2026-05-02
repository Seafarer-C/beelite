import { app, BrowserWindow, ipcMain, shell } from "electron";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import type {
  LlmSetProviderPayload,
  ResearchFetchPageParams,
  ResearchSearchParams,
  ResearchSetSettingsPayload
} from "@beelite/shared";
import { createImportService, type ImportService } from "./services/importService";
import { createLlmSettingsStore, type LlmSettingsStore } from "./services/llmSettingsStore";
import { closeResearchBrowser } from "@beelite/research-engine";
import { createResearchSettingsStore, type ResearchSettingsStore } from "./services/researchSettingsStore";

const currentDir = fileURLToPath(new URL(".", import.meta.url));

/** electron-vite may emit `index.mjs`; packaged/dev paths must match actual file */
function resolvePreloadScript(): string {
  const js = join(currentDir, "../preload/index.js");
  const mjs = join(currentDir, "../preload/index.mjs");
  if (existsSync(mjs)) return mjs;
  return js;
}
let importService: ImportService | undefined;
let llmSettingsStore: LlmSettingsStore | undefined;
let researchSettingsStore: ResearchSettingsStore | undefined;

function createMainWindow(): void {
  const mainWindow = new BrowserWindow({
    width: 1440,
    height: 960,
    minWidth: 1120,
    minHeight: 720,
    title: "BeeLite",
    backgroundColor: "#f7f7f4",
    titleBarStyle: "hiddenInset",
    trafficLightPosition: { x: 18, y: 18 },
    webPreferences: {
      preload: resolvePreloadScript(),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });

  mainWindow.webContents.on("before-input-event", (event, input) => {
    const isDevToolsShortcut =
      input.key === "F12" ||
      (input.key.toLowerCase() === "i" && input.alt && (input.meta || input.control));

    if (!isDevToolsShortcut) return;

    event.preventDefault();
    if (mainWindow.webContents.isDevToolsOpened()) {
      mainWindow.webContents.closeDevTools();
    } else {
      mainWindow.webContents.openDevTools({ mode: "detach" });
    }
  });

  if (process.env.ELECTRON_RENDERER_URL) {
    mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL);
  } else {
    mainWindow.loadFile(join(currentDir, "../renderer/index.html"));
  }
}

app.whenReady().then(async () => {
  const userData = app.getPath("userData");
  importService = await createImportService(userData);
  llmSettingsStore = await createLlmSettingsStore(userData, importService.getKnowledgeRepository());
  researchSettingsStore = await createResearchSettingsStore(userData, importService.getKnowledgeRepository());

  ipcMain.handle("app:versions", () => ({
    chrome: process.versions.chrome,
    electron: process.versions.electron,
    node: process.versions.node
  }));
  ipcMain.handle("storage:stats", () => importService?.getStats());
  ipcMain.handle("imports:listJobs", () => importService?.listJobs() ?? []);
  ipcMain.handle("imports:listSources", () => importService?.listSources() ?? []);
  ipcMain.handle("imports:chatgpt", (event) => {
    const window = BrowserWindow.fromWebContents(event.sender);
    if (!window || !importService) return null;
    return importService.importChatGpt(window);
  });
  ipcMain.handle("imports:bookmarks", (event) => {
    const window = BrowserWindow.fromWebContents(event.sender);
    if (!window || !importService) return null;
    return importService.importBookmarks(window);
  });
  ipcMain.handle("workspace:load", () => importService?.loadWorkspace());
  ipcMain.handle("llm:getSettings", () => llmSettingsStore!.getPublic());
  ipcMain.handle("llm:setProvider", (_event, payload: LlmSetProviderPayload) =>
    llmSettingsStore!.setProvider(payload)
  );
  ipcMain.handle("research:getSettings", () => researchSettingsStore!.getPublic());
  ipcMain.handle("research:setSettings", (_event, payload: ResearchSetSettingsPayload) =>
    researchSettingsStore!.setSettings(payload)
  );
  ipcMain.handle("research:search", (_event, params: ResearchSearchParams) =>
    researchSettingsStore!.search(params)
  );
  ipcMain.handle("research:fetchPage", (_event, params: ResearchFetchPageParams) =>
    researchSettingsStore!.fetchPage(params)
  );
  ipcMain.handle("app:openExternal", (_event, url: string) => {
    try {
      const parsed = new URL(url);
      if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return false;
      void shell.openExternal(url);
      return true;
    } catch {
      return false;
    }
  });

  createMainWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("before-quit", () => {
  importService?.close();
  llmSettingsStore?.close();
  researchSettingsStore?.close();
  void closeResearchBrowser();
});
