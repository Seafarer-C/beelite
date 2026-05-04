import type {
  GraphProposal,
  ImportJob,
  ImportKind,
  ImportStats,
  KnowledgeBlock,
  KnowledgeEdge,
  KnowledgeNode,
  KnowledgeSource,
  KnowledgeSpace
} from "@beelite/shared";

/** LLM 提供商一行（主进程持久化；apiKey 为明文） */
export interface LlmProviderPersistRow {
  providerId: string;
  apiKey: string | null;
  baseUrl: string | null;
  model: string | null;
}

/** Research 搜索配置单行（singleton = 1） */
export interface ResearchSearchPersistRow {
  provider: string;
  apiKey: string | null;
}

export interface PersistedParsedImport {
  kind: ImportKind;
  sources: KnowledgeSource[];
  nodes: KnowledgeNode[];
  edges: KnowledgeEdge[];
  proposal: GraphProposal;
}

/** 本地静默同步的浏览器收藏夹快照（按浏览器聚合多 profile） */
export interface BrowserBookmarkSnapshotRow {
  id: string;
  browserType: string;
  collections: unknown;
  contentHash: string;
  updatedAt: string;
}

/** 收藏夹变更日志（delta 为 jsondiffpatch 结构；首次同步可为 null） */
export interface BrowserBookmarkChangeLogRow {
  id: number;
  browserType: string;
  occurredAt: string;
  previousHash: string | null;
  newHash: string;
  deltaJson: unknown | null;
  summary: string | null;
}

export interface KnowledgeRepository {
  initialize(): void;
  close(): void;
  createImportJob(input: { kind: ImportKind; filePath?: string }): ImportJob;
  completeImportJob(job: ImportJob, imported: PersistedParsedImport): ImportJob;
  failImportJob(job: ImportJob, error: string): ImportJob;
  saveSources(sources: KnowledgeSource[]): void;
  saveNodes(nodes: KnowledgeNode[]): void;
  saveEdges(edges: KnowledgeEdge[]): void;
  saveSpaces(spaces: KnowledgeSpace[]): void;
  saveBlocks(blocks: KnowledgeBlock[]): void;
  deleteBlocksForSpace(spaceId: string): void;
  saveGraphProposal(proposal: GraphProposal): void;
  listImportJobs(limit?: number): ImportJob[];
  listSources(limit?: number): KnowledgeSource[];
  listSpaces(): KnowledgeSpace[];
  listBlocks(spaceId?: string): KnowledgeBlock[];
  listNodes(): KnowledgeNode[];
  listEdges(): KnowledgeEdge[];
  listLatestGraphProposal(): GraphProposal | null;
  getStats(): ImportStats;
  listLlmProviderSettings(): LlmProviderPersistRow[];
  saveLlmProvider(
    providerId: string,
    patch: { apiKey?: string | null; baseUrl?: string | null; model?: string | null }
  ): void;
  getResearchSearchSettings(): ResearchSearchPersistRow | null;
  saveResearchSearchSettings(patch: {
    provider?: string | null;
    apiKey?: string | null;
  }): void;

  getBrowserBookmarkSnapshot(browserKey: string): BrowserBookmarkSnapshotRow | null;
  upsertBrowserBookmarkSnapshot(row: BrowserBookmarkSnapshotRow): void;
  listBrowserBookmarkSnapshots(): BrowserBookmarkSnapshotRow[];
  appendBrowserBookmarkChangeLog(
    row: Omit<BrowserBookmarkChangeLogRow, "id">
  ): BrowserBookmarkChangeLogRow;
  listBrowserBookmarkChangeLogs(limit?: number): BrowserBookmarkChangeLogRow[];
}

export function serializeJson(value: unknown): string {
  return JSON.stringify(value ?? null);
}

export function parseJson<T>(value: unknown, fallback: T): T {
  if (typeof value !== "string" || value.length === 0) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

export function createImportJobRecord(input: {
  id: string;
  kind: ImportKind;
  filePath?: string;
}): ImportJob {
  return {
    id: input.id,
    kind: input.kind,
    status: "running",
    filePath: input.filePath,
    sourceCount: 0,
    nodeCount: 0,
    edgeCount: 0,
    startedAt: new Date().toISOString()
  };
}
