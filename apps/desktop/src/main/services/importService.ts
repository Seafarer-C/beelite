import { dialog, type BrowserWindow } from "electron";
import { mkdir, readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import {
  buildBrowserBookmarksImport,
  buildChatGptImport,
  type ParsedImport
} from "@beelite/ingestion-engine";
import { createRootSpace, mapNodesToBlocks } from "@beelite/space-engine";
import type {
  ImportJob,
  ImportRunResult,
  ImportStats,
  KnowledgeSource,
  WorkspaceSnapshot
} from "@beelite/shared";
import type { KnowledgeRepository } from "@beelite/storage-engine";
import { createNodeSqliteRepository } from "@beelite/storage-engine/node";

export interface ImportService {
  isReady(): boolean;
  importChatGpt(window: BrowserWindow): Promise<ImportRunResult | null>;
  importBookmarks(window: BrowserWindow): Promise<ImportRunResult | null>;
  listJobs(): ImportJob[];
  listSources(): KnowledgeSource[];
  getStats(): ImportStats;
  loadWorkspace(): WorkspaceSnapshot;
  close(): void;
  /** 与知识库共用 `beelite.sqlite`；禁用时返回 undefined（LLM 设置将单独打开库连接） */
  getKnowledgeRepository(): KnowledgeRepository | undefined;
}

const emptyStats: ImportStats = {
  sources: 0,
  nodes: 0,
  edges: 0,
  spaces: 0,
  blocks: 0,
  proposals: 0,
  importJobs: 0
};

export async function createImportService(userDataPath: string): Promise<ImportService> {
  const dbPath = join(userDataPath, "beelite.sqlite");

  try {
    await mkdir(dirname(dbPath), { recursive: true });
    const repository = await createNodeSqliteRepository(dbPath);
    repository.initialize();
    seedRootSpace(repository);
    return new SqliteImportService(repository);
  } catch (error) {
    console.error("SQLite import service failed to initialize", error);
    return new DisabledImportService(error);
  }
}

class SqliteImportService implements ImportService {
  constructor(private readonly repository: KnowledgeRepository) {}

  getKnowledgeRepository(): KnowledgeRepository | undefined {
    return this.repository;
  }

  isReady(): boolean {
    return true;
  }

  loadWorkspace(): WorkspaceSnapshot {
    syncRootLayout(this.repository);
    return {
      spaces: this.repository.listSpaces(),
      blocks: this.repository.listBlocks(),
      nodes: this.repository.listNodes(),
      edges: this.repository.listEdges(),
      proposal: this.repository.listLatestGraphProposal()
    };
  }

  async importChatGpt(window: BrowserWindow): Promise<ImportRunResult | null> {
    return this.importJsonFile(window, {
      kindLabel: "ChatGPT conversations.json",
      filters: [{ name: "ChatGPT export", extensions: ["json"] }],
      parse: buildChatGptImport
    });
  }

  async importBookmarks(window: BrowserWindow): Promise<ImportRunResult | null> {
    return this.importJsonFile(window, {
      kindLabel: "Chromium Bookmarks JSON",
      filters: [
        { name: "Bookmarks JSON", extensions: ["json"] },
        { name: "All files", extensions: ["*"] }
      ],
      parse: buildBrowserBookmarksImport
    });
  }

  listJobs(): ImportJob[] {
    return this.repository.listImportJobs();
  }

  listSources(): KnowledgeSource[] {
    return this.repository.listSources();
  }

  getStats(): ImportStats {
    return this.repository.getStats();
  }

  close(): void {
    this.repository.close();
  }

  private async importJsonFile(
    window: BrowserWindow,
    options: {
      kindLabel: string;
      filters: Electron.FileFilter[];
      parse: (raw: unknown, filePath?: string) => ParsedImport;
    }
  ): Promise<ImportRunResult | null> {
    const result = await dialog.showOpenDialog(window, {
      title: `导入 ${options.kindLabel}`,
      properties: ["openFile"],
      filters: options.filters
    });

    if (result.canceled || result.filePaths.length === 0) return null;

    const filePath = result.filePaths[0];
    const rawJson = await readJsonFile(filePath);
    const parsed = options.parse(rawJson, filePath);
    const job = this.repository.createImportJob({ kind: parsed.kind, filePath });

    try {
      const completed = this.repository.completeImportJob(job, parsed);
      syncRootLayout(this.repository);
      return {
        job: completed,
        stats: this.repository.getStats(),
        preview: {
          sources: parsed.sources.slice(0, 8),
          nodes: parsed.nodes.slice(0, 8),
          edges: parsed.edges.slice(0, 8)
        }
      };
    } catch (error) {
      const failed = this.repository.failImportJob(job, errorMessage(error));
      return {
        job: failed,
        stats: this.repository.getStats(),
        preview: {
          sources: [],
          nodes: [],
          edges: []
        }
      };
    }
  }
}

class DisabledImportService implements ImportService {
  constructor(private readonly error: unknown) {}

  getKnowledgeRepository(): KnowledgeRepository | undefined {
    return undefined;
  }

  isReady(): boolean {
    return false;
  }

  loadWorkspace(): WorkspaceSnapshot {
    return {
      spaces: [],
      blocks: [],
      nodes: [],
      edges: [],
      proposal: null
    };
  }

  async importChatGpt(): Promise<ImportRunResult | null> {
    throw new Error(`SQLite unavailable: ${errorMessage(this.error)}`);
  }

  async importBookmarks(): Promise<ImportRunResult | null> {
    throw new Error(`SQLite unavailable: ${errorMessage(this.error)}`);
  }

  listJobs(): ImportJob[] {
    return [];
  }

  listSources(): KnowledgeSource[] {
    return [];
  }

  getStats(): ImportStats {
    return emptyStats;
  }

  close(): void {}
}

async function readJsonFile(path: string): Promise<unknown> {
  const content = await readFile(path, "utf8");
  return JSON.parse(content) as unknown;
}

const ROOT_SPACE_ID = "space-root";

function seedRootSpace(repository: KnowledgeRepository): void {
  if (repository.getStats().spaces > 0) return;
  repository.saveSpaces([createRootSpace()]);
}

function syncRootLayout(repository: KnowledgeRepository): void {
  const spaces = repository.listSpaces();
  let root = spaces.find((s) => s.id === ROOT_SPACE_ID);
  if (!root) {
    root = createRootSpace();
    repository.saveSpaces([root]);
  }

  const nodes = repository.listNodes();
  const blocks = mapNodesToBlocks({
    spaceId: root.id,
    nodes,
    columns: 3,
    origin: { x: -420, y: -240 }
  });

  const now = new Date().toISOString();
  const updatedRoot = {
    ...root,
    nodeIds: nodes.map((n) => n.id),
    blockIds: blocks.map((b) => b.id),
    updatedAt: now
  };

  repository.deleteBlocksForSpace(root.id);
  repository.saveSpaces([updatedRoot]);
  repository.saveBlocks(blocks);
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
