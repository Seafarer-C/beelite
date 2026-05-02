import type { DatabaseSync } from "node:sqlite";
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
import { INITIAL_SQLITE_SCHEMA } from "./index";
import { applySqliteSchemaPatches } from "./sqlite-migrations";
import {
  createImportJobRecord,
  parseJson,
  serializeJson,
  type KnowledgeRepository,
  type LlmProviderPersistRow,
  type ResearchSearchPersistRow,
  type PersistedParsedImport
} from "./repository";

type SQLiteDatabase = Pick<DatabaseSync, "close" | "exec" | "prepare">;

interface CountRow {
  count?: number;
}

export async function createNodeSqliteRepository(path: string): Promise<KnowledgeRepository> {
  const sqlite = await import("node:sqlite");
  const db = new sqlite.DatabaseSync(path, {
    enableForeignKeyConstraints: true,
    timeout: 5000
  });

  return new NodeSqliteKnowledgeRepository(db);
}

export class NodeSqliteKnowledgeRepository implements KnowledgeRepository {
  private readonly db: SQLiteDatabase;

  constructor(db: SQLiteDatabase) {
    this.db = db;
  }

  initialize(): void {
    this.db.exec("PRAGMA journal_mode = WAL;");
    this.db.exec("PRAGMA synchronous = NORMAL;");
    this.db.exec(INITIAL_SQLITE_SCHEMA);
    applySqliteSchemaPatches(this.db);
  }

  close(): void {
    this.db.close();
  }

  createImportJob(input: { kind: ImportKind; filePath?: string }): ImportJob {
    const job = createImportJobRecord({
      id: `import-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
      kind: input.kind,
      filePath: input.filePath
    });

    this.db
      .prepare(
        `INSERT INTO import_jobs
         (id, kind, status, file_path, source_count, node_count, edge_count, error, started_at, finished_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        job.id,
        job.kind,
        job.status,
        job.filePath ?? null,
        job.sourceCount,
        job.nodeCount,
        job.edgeCount,
        job.error ?? null,
        job.startedAt,
        job.finishedAt ?? null
      );

    return job;
  }

  completeImportJob(job: ImportJob, imported: PersistedParsedImport): ImportJob {
    this.db.exec("BEGIN");
    try {
      this.saveSources(imported.sources);
      this.saveNodes(imported.nodes);
      this.saveEdges(imported.edges);
      this.saveGraphProposal(imported.proposal);

      const completed: ImportJob = {
        ...job,
        status: "completed",
        sourceCount: imported.sources.length,
        nodeCount: imported.nodes.length,
        edgeCount: imported.edges.length,
        finishedAt: new Date().toISOString()
      };

      this.updateImportJob(completed);
      this.db.exec("COMMIT");
      return completed;
    } catch (error) {
      this.db.exec("ROLLBACK");
      throw error;
    }
  }

  failImportJob(job: ImportJob, error: string): ImportJob {
    const failed: ImportJob = {
      ...job,
      status: "failed",
      error,
      finishedAt: new Date().toISOString()
    };
    this.updateImportJob(failed);
    return failed;
  }

  saveSources(sources: KnowledgeSource[]): void {
    const statement = this.db.prepare(
      `INSERT INTO knowledge_sources
       (id, type, title, path, url, imported_at, metadata_json)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         type = excluded.type,
         title = excluded.title,
         path = excluded.path,
         url = excluded.url,
         imported_at = excluded.imported_at,
         metadata_json = excluded.metadata_json`
    );

    sources.forEach((source) => {
      statement.run(
        source.id,
        source.type,
        source.title,
        source.path ?? null,
        source.url ?? null,
        source.importedAt,
        serializeJson(source.metadata)
      );
    });
  }

  saveNodes(nodes: KnowledgeNode[]): void {
    const statement = this.db.prepare(
      `INSERT INTO knowledge_nodes
       (id, type, title, summary, confidence, payload_json, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         type = excluded.type,
         title = excluded.title,
         summary = excluded.summary,
         confidence = excluded.confidence,
         payload_json = excluded.payload_json,
         updated_at = excluded.updated_at`
    );

    nodes.forEach((node) => {
      statement.run(
        node.id,
        node.type,
        node.title,
        node.summary,
        node.confidence,
        serializeJson(node),
        node.createdAt,
        node.updatedAt
      );
    });
  }

  saveEdges(edges: KnowledgeEdge[]): void {
    const statement = this.db.prepare(
      `INSERT INTO knowledge_edges
       (id, source_id, target_id, relation_type, weight, confidence, payload_json, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         source_id = excluded.source_id,
         target_id = excluded.target_id,
         relation_type = excluded.relation_type,
         weight = excluded.weight,
         confidence = excluded.confidence,
         payload_json = excluded.payload_json`
    );

    edges.forEach((edge) => {
      statement.run(
        edge.id,
        edge.sourceId,
        edge.targetId,
        edge.relationType,
        edge.weight,
        edge.confidence,
        serializeJson(edge),
        edge.createdAt
      );
    });
  }

  saveSpaces(spaces: KnowledgeSpace[]): void {
    const statement = this.db.prepare(
      `INSERT INTO knowledge_spaces
       (id, title, parent_space_id, layout_type, viewport_json, payload_json, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         title = excluded.title,
         parent_space_id = excluded.parent_space_id,
         layout_type = excluded.layout_type,
         viewport_json = excluded.viewport_json,
         payload_json = excluded.payload_json,
         updated_at = excluded.updated_at`
    );

    spaces.forEach((space) => {
      statement.run(
        space.id,
        space.title,
        space.parentSpaceId ?? null,
        space.layoutType,
        serializeJson(space.viewportState),
        serializeJson(space),
        space.createdAt,
        space.updatedAt
      );
    });
  }

  saveBlocks(blocks: KnowledgeBlock[]): void {
    const statement = this.db.prepare(
      `INSERT INTO knowledge_blocks
       (id, space_id, node_id, type, geometry_json, content_json, metadata_json)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         space_id = excluded.space_id,
         node_id = excluded.node_id,
         type = excluded.type,
         geometry_json = excluded.geometry_json,
         content_json = excluded.content_json,
         metadata_json = excluded.metadata_json`
    );

    blocks.forEach((block) => {
      statement.run(
        block.id,
        block.spaceId,
        block.nodeId ?? null,
        block.type,
        serializeJson({
          x: block.x,
          y: block.y,
          width: block.width,
          height: block.height,
          rotation: block.rotation,
          zIndex: block.zIndex
        }),
        serializeJson(block.content),
        serializeJson(block.metadata)
      );
    });
  }

  deleteBlocksForSpace(spaceId: string): void {
    this.db.prepare(`DELETE FROM knowledge_blocks WHERE space_id = ?`).run(spaceId);
  }

  saveGraphProposal(proposal: GraphProposal): void {
    this.db
      .prepare(
        `INSERT INTO graph_proposals
         (id, status, title, source_ids_json, proposal_json, created_at)
         VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           status = excluded.status,
           title = excluded.title,
           source_ids_json = excluded.source_ids_json,
           proposal_json = excluded.proposal_json`
      )
      .run(
        proposal.id,
        proposal.status,
        proposal.title,
        serializeJson(proposal.sourceIds),
        serializeJson(proposal),
        proposal.createdAt
      );
  }

  listImportJobs(limit = 20): ImportJob[] {
    return this.db
      .prepare(
        `SELECT id, kind, status, file_path, source_count, node_count, edge_count, error, started_at, finished_at
         FROM import_jobs
         ORDER BY started_at DESC
         LIMIT ?`
      )
      .all(limit)
      .map((row: Record<string, unknown>) => importJobFromRow(row));
  }

  listSources(limit = 50): KnowledgeSource[] {
    return this.db
      .prepare(
        `SELECT id, type, title, path, url, imported_at, metadata_json
         FROM knowledge_sources
         ORDER BY imported_at DESC
         LIMIT ?`
      )
      .all(limit)
      .map((row: Record<string, unknown>) => ({
        id: String(row.id),
        type: String(row.type) as KnowledgeSource["type"],
        title: String(row.title),
        path: typeof row.path === "string" ? row.path : undefined,
        url: typeof row.url === "string" ? row.url : undefined,
        importedAt: String(row.imported_at),
        metadata: parseJson<Record<string, unknown>>(row.metadata_json, {})
      }));
  }

  listSpaces(): KnowledgeSpace[] {
    return this.db
      .prepare(
        `SELECT payload_json FROM knowledge_spaces
         ORDER BY created_at ASC`
      )
      .all()
      .map((row: Record<string, unknown>) =>
        parseJson<KnowledgeSpace>(row.payload_json, {} as KnowledgeSpace)
      )
      .filter((space: KnowledgeSpace) => Boolean(space?.id));
  }

  listBlocks(spaceId?: string): KnowledgeBlock[] {
    const sql = spaceId
      ? `SELECT id, space_id, node_id, type, geometry_json, content_json, metadata_json
         FROM knowledge_blocks WHERE space_id = ? ORDER BY id ASC`
      : `SELECT id, space_id, node_id, type, geometry_json, content_json, metadata_json
         FROM knowledge_blocks ORDER BY space_id ASC, id ASC`;

    const rows = spaceId
      ? (this.db.prepare(sql).all(spaceId) as Record<string, unknown>[])
      : (this.db.prepare(sql).all() as Record<string, unknown>[]);

    return rows.map((row) => knowledgeBlockFromRow(row));
  }

  listNodes(): KnowledgeNode[] {
    return this.db
      .prepare(`SELECT payload_json FROM knowledge_nodes ORDER BY created_at ASC, id ASC`)
      .all()
      .map((row: Record<string, unknown>) =>
        parseJson<KnowledgeNode>(row.payload_json, {} as KnowledgeNode)
      )
      .filter((node: KnowledgeNode) => Boolean(node?.id));
  }

  listEdges(): KnowledgeEdge[] {
    return this.db
      .prepare(`SELECT payload_json FROM knowledge_edges ORDER BY created_at DESC`)
      .all()
      .map((row: Record<string, unknown>) =>
        parseJson<KnowledgeEdge>(row.payload_json, {} as KnowledgeEdge)
      )
      .filter((edge: KnowledgeEdge) => Boolean(edge?.id));
  }

  listLatestGraphProposal(): GraphProposal | null {
    const row = this.db
      .prepare(
        `SELECT proposal_json FROM graph_proposals
         ORDER BY created_at DESC
         LIMIT 1`
      )
      .get() as Record<string, unknown> | undefined;

    if (!row?.proposal_json) return null;
    const proposal = parseJson<GraphProposal>(row.proposal_json, {} as GraphProposal);
    return proposal?.id ? proposal : null;
  }

  getStats(): ImportStats {
    return {
      sources: this.count("knowledge_sources"),
      nodes: this.count("knowledge_nodes"),
      edges: this.count("knowledge_edges"),
      spaces: this.count("knowledge_spaces"),
      blocks: this.count("knowledge_blocks"),
      proposals: this.count("graph_proposals"),
      importJobs: this.count("import_jobs")
    };
  }

  listLlmProviderSettings(): LlmProviderPersistRow[] {
    return this.db
      .prepare(`SELECT provider_id, api_key, base_url, model FROM llm_provider_settings`)
      .all()
      .map((row: Record<string, unknown>) => ({
        providerId: String(row.provider_id),
        apiKey: row.api_key == null ? null : String(row.api_key),
        baseUrl: row.base_url == null ? null : String(row.base_url),
        model: row.model == null ? null : String(row.model)
      }));
  }

  saveLlmProvider(
    providerId: string,
    patch: { apiKey?: string | null; baseUrl?: string | null; model?: string | null }
  ): void {
    const cur = this.db
      .prepare(
        `SELECT api_key, base_url, model FROM llm_provider_settings WHERE provider_id = ?`
      )
      .get(providerId) as Record<string, unknown> | undefined;

    let apiKey = cur?.api_key == null ? null : String(cur.api_key);
    let baseUrl = cur?.base_url == null ? null : String(cur.base_url);
    let model = cur?.model == null ? null : String(cur.model);

    if (patch.apiKey !== undefined) apiKey = patch.apiKey;
    if (patch.baseUrl !== undefined) baseUrl = patch.baseUrl;
    if (patch.model !== undefined) model = patch.model;

    const hasKey = Boolean(apiKey && apiKey.length > 0);
    const hasBase = Boolean(baseUrl && baseUrl.length > 0);
    const hasModel = Boolean(model && model.length > 0);

    if (!hasKey && !hasBase && !hasModel) {
      this.db.prepare(`DELETE FROM llm_provider_settings WHERE provider_id = ?`).run(providerId);
      return;
    }

    this.db
      .prepare(
        `INSERT INTO llm_provider_settings (provider_id, api_key, base_url, model)
         VALUES (?, ?, ?, ?)
         ON CONFLICT(provider_id) DO UPDATE SET
           api_key = excluded.api_key,
           base_url = excluded.base_url,
           model = excluded.model`
      )
      .run(
        providerId,
        hasKey ? apiKey : null,
        hasBase ? baseUrl : null,
        hasModel ? model : null
      );
  }

  getResearchSearchSettings(): ResearchSearchPersistRow | null {
    const row = this.db
      .prepare(`SELECT provider, api_key FROM research_search_settings WHERE singleton = 1`)
      .get() as Record<string, unknown> | undefined;
    if (!row) return null;
    return {
      provider: String(row.provider ?? "brave"),
      apiKey: row.api_key == null ? null : String(row.api_key)
    };
  }

  saveResearchSearchSettings(patch: { provider?: string | null; apiKey?: string | null }): void {
    const cur = this.getResearchSearchSettings();
    let provider = cur?.provider ?? "brave";
    let apiKey = cur?.apiKey ?? null;

    if (patch.provider !== undefined) {
      const p = patch.provider?.trim();
      provider = p && p.length > 0 ? p : "brave";
    }

    if (patch.apiKey !== undefined) {
      if (patch.apiKey === null) {
        apiKey = null;
      } else {
        const k = patch.apiKey.trim();
        apiKey = k.length > 0 ? k : null;
      }
    }

    this.db
      .prepare(
        `INSERT INTO research_search_settings (singleton, provider, api_key)
         VALUES (1, ?, ?)
         ON CONFLICT(singleton) DO UPDATE SET
           provider = excluded.provider,
           api_key = excluded.api_key`
      )
      .run(provider, apiKey);
  }

  private updateImportJob(job: ImportJob): void {
    this.db
      .prepare(
        `UPDATE import_jobs
         SET status = ?, source_count = ?, node_count = ?, edge_count = ?, error = ?, finished_at = ?
         WHERE id = ?`
      )
      .run(
        job.status,
        job.sourceCount,
        job.nodeCount,
        job.edgeCount,
        job.error ?? null,
        job.finishedAt ?? null,
        job.id
      );
  }

  private count(table: string): number {
    const row = this.db.prepare(`SELECT COUNT(*) AS count FROM ${table}`).get() as CountRow | undefined;
    return Number(row?.count ?? 0);
  }
}

function importJobFromRow(row: Record<string, unknown>): ImportJob {
  return {
    id: String(row.id),
    kind: String(row.kind) as ImportKind,
    status: String(row.status) as ImportJob["status"],
    filePath: typeof row.file_path === "string" ? row.file_path : undefined,
    sourceCount: Number(row.source_count ?? 0),
    nodeCount: Number(row.node_count ?? 0),
    edgeCount: Number(row.edge_count ?? 0),
    error: typeof row.error === "string" ? row.error : undefined,
    startedAt: String(row.started_at),
    finishedAt: typeof row.finished_at === "string" ? row.finished_at : undefined
  };
}

interface BlockGeometry {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  rotation?: number;
  zIndex?: number;
}

function knowledgeBlockFromRow(row: Record<string, unknown>): KnowledgeBlock {
  const geometry = parseJson<BlockGeometry>(row.geometry_json, {});
  const content = parseJson<Record<string, unknown>>(row.content_json, {});
  const metadata = parseJson<Record<string, unknown>>(row.metadata_json, {});

  return {
    id: String(row.id),
    spaceId: String(row.space_id),
    nodeId: typeof row.node_id === "string" ? row.node_id : undefined,
    type: String(row.type) as KnowledgeBlock["type"],
    x: Number(geometry.x ?? 0),
    y: Number(geometry.y ?? 0),
    width: Number(geometry.width ?? 280),
    height: Number(geometry.height ?? 200),
    rotation: Number(geometry.rotation ?? 0),
    zIndex: Number(geometry.zIndex ?? 0),
    content,
    metadata
  };
}
