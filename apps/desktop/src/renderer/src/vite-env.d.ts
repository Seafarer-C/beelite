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
      loadWorkspace: () => Promise<WorkspaceSnapshot | undefined>;
      getLlmSettings: () => Promise<LlmSettingsPublic | null>;
      setLlmProvider: (payload: LlmSetProviderPayload) => Promise<LlmSettingsPublic | null>;
      getResearchSettings: () => Promise<ResearchSettingsPublic | null>;
      setResearchSettings: (payload: ResearchSetSettingsPayload) => Promise<ResearchSettingsPublic | null>;
      researchSearch: (params: ResearchSearchParams) => Promise<ResearchSearchResult>;
      researchFetchPage: (params: ResearchFetchPageParams) => Promise<ResearchFetchPageResult>;
      openExternal: (url: string) => Promise<boolean>;
    };
  }
}

export {};
