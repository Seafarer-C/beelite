/// <reference types="vite/client" />

import type {
  ImportJob,
  ImportRunResult,
  ImportStats,
  KnowledgeSource,
  LlmSetProviderPayload,
  LlmSettingsPublic,
  ResearchFetchPageParams,
  ResearchFetchPageResult,
  ResearchSearchParams,
  ResearchSearchResult,
  ResearchSetSettingsPayload,
  ResearchSettingsPublic,
  WorkspaceSnapshot
} from "@beelite/shared";
import type { LocalBookmarksPreview, LocalChromiumBookmarkProfile } from "./types/localBookmarks";
import type {
  BrowserBookmarkChangeLogRow,
  BrowserBookmarkSnapshotRow,
  SqliteInspectorColumnInfo,
  SqliteInspectorPageResult,
  SqliteInspectorSqlResult,
  SqliteInspectorTableSummary
} from "@beelite/storage-engine";

declare global {
  interface Window {
    beelite?: {
      versions: () => Promise<{
        chrome: string;
        electron: string;
        node: string;
      }>;
      storageStats: () => Promise<ImportStats>;
      listImportJobs: () => Promise<ImportJob[]>;
      listSources: () => Promise<KnowledgeSource[]>;
      importChatGpt: () => Promise<ImportRunResult | null>;
      importBookmarks: () => Promise<ImportRunResult | null>;
      scanLocalBrowserBookmarks: () => Promise<LocalChromiumBookmarkProfile[]>;
      previewLocalBookmarksFile: (bookmarksFilePath: string) => Promise<LocalBookmarksPreview>;
      listBookmarkSnapshots: () => Promise<BrowserBookmarkSnapshotRow[]>;
      listBookmarkChangeLogs: (limit?: number) => Promise<BrowserBookmarkChangeLogRow[]>;
      runBookmarkSync: () => Promise<{ ok: true } | { ok: false; error: string }>;
      loadWorkspace: () => Promise<WorkspaceSnapshot | undefined>;
      getLlmSettings: () => Promise<LlmSettingsPublic | null>;
      setLlmProvider: (payload: LlmSetProviderPayload) => Promise<LlmSettingsPublic | null>;
      getResearchSettings: () => Promise<ResearchSettingsPublic | null>;
      setResearchSettings: (payload: ResearchSetSettingsPayload) => Promise<ResearchSettingsPublic | null>;
      researchSearch: (params: ResearchSearchParams) => Promise<ResearchSearchResult>;
      researchFetchPage: (params: ResearchFetchPageParams) => Promise<ResearchFetchPageResult>;
      openExternal: (url: string) => Promise<boolean>;
      dbListTables: () => Promise<
        { ok: true; tables: SqliteInspectorTableSummary[] } | { ok: false; error: string }
      >;
      dbTableColumns: (
        tableName: string
      ) => Promise<
        { ok: true; columns: SqliteInspectorColumnInfo[] } | { ok: false; error: string }
      >;
      dbTablePage: (
        tableName: string,
        limit: number,
        offset: number
      ) => Promise<{ ok: true; page: SqliteInspectorPageResult } | { ok: false; error: string }>;
      dbRunReadOnlySql: (sql: string) => Promise<SqliteInspectorSqlResult>;
    };
  }
}

export {};
