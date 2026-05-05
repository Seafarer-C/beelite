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
import {
  previewLocalBookmarksFile,
  scanLocalChromiumBookmarkProfiles
} from "./services/localBrowserBookmarks";
import {
  scheduleBrowserBookmarkSync,
  syncBrowserBookmarksToRepository
} from "./services/bookmarkSyncService";
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
  ipcMain.handle("bookmarks:scanLocal", () => scanLocalChromiumBookmarkProfiles());
  ipcMain.handle("bookmarks:preview", (_event, bookmarksFilePath: string) =>
    previewLocalBookmarksFile(bookmarksFilePath)
  );
  ipcMain.handle("bookmarks:listSnapshots", () => {
    const repo = importService?.getKnowledgeRepository();
    return repo?.listBrowserBookmarkSnapshots() ?? [];
  });
  ipcMain.handle("bookmarks:listChangeLogs", (_event, limit?: number) => {
    const repo = importService?.getKnowledgeRepository();
    return repo?.listBrowserBookmarkChangeLogs(limit) ?? [];
  });
  ipcMain.handle("bookmarks:runSync", async () => {
    const repo = importService?.getKnowledgeRepository();
    if (!repo) return { ok: false as const, error: "SQLite repository unavailable" };
    try {
      await syncBrowserBookmarksToRepository(repo);
      return { ok: true as const };
    } catch (error) {
      return {
        ok: false as const,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  });
  ipcMain.handle("workspace:load", () => importService?.loadWorkspace());

  ipcMain.handle("db:listTables", () => {
    const repo = importService?.getKnowledgeRepository();
    if (!repo) return { ok: false as const, error: "SQLite repository unavailable" };
    try {
      return { ok: true as const, tables: repo.inspectListTables() };
    } catch (error) {
      return {
        ok: false as const,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  });
  ipcMain.handle("db:tableColumns", (_event, tableName: string) => {
    const repo = importService?.getKnowledgeRepository();
    if (!repo) return { ok: false as const, error: "SQLite repository unavailable" };
    try {
      return { ok: true as const, columns: repo.inspectTableColumns(String(tableName)) };
    } catch (error) {
      return {
        ok: false as const,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  });
  ipcMain.handle("db:tablePage", (_event, tableName: string, limit: number, offset: number) => {
    const repo = importService?.getKnowledgeRepository();
    if (!repo) return { ok: false as const, error: "SQLite repository unavailable" };
    try {
      return {
        ok: true as const,
        page: repo.inspectTablePage(String(tableName), Number(limit), Number(offset))
      };
    } catch (error) {
      return {
        ok: false as const,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  });
  ipcMain.handle("db:runReadOnlySql", (_event, sql: string) => {
    const repo = importService?.getKnowledgeRepository();
    if (!repo) return { ok: false as const, error: "SQLite repository unavailable" };
    return repo.inspectRunReadOnlySql(String(sql));
  });
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

  scheduleBrowserBookmarkSync(() => importService?.getKnowledgeRepository());

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
