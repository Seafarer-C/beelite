/**
 * 旧版 beelite.sqlite 在 CREATE TABLE IF NOT EXISTS 下不会更新已有表结构；
 * 在 initialize 之后补齐缺失列，避免 SELECT payload_json 等报错。
 */

type SqliteExecDb = {
  prepare(sql: string): {
    all(...params: unknown[]): unknown[];
    get(...params: unknown[]): unknown;
  };
  exec(sql: string): void;
};

const KNOWN_TABLES = [
  "knowledge_nodes",
  "knowledge_edges",
  "knowledge_spaces",
  "knowledge_blocks",
  "knowledge_sources",
  "graph_proposals",
  "import_jobs"
] as const;

type KnownTable = (typeof KNOWN_TABLES)[number];

function existingColumns(db: SqliteExecDb, table: KnownTable): Set<string> {
  const row = db
    .prepare(`SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?`)
    .get(table);
  if (!row) return new Set();
  const rows = db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[];
  return new Set(rows.map((r) => r.name));
}

function addColumnIfMissing(
  db: SqliteExecDb,
  table: KnownTable,
  column: string,
  ddlSuffix: string
): void {
  if (existingColumns(db, table).has(column)) return;
  db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${ddlSuffix}`);
}

/** 按表补齐历史上可能缺失的列（列名固定，避免拼接注入） */
export function applySqliteSchemaPatches(db: SqliteExecDb): void {
  const patches: Record<KnownTable, [string, string][]> = {
    knowledge_nodes: [
      ["summary", "TEXT NOT NULL DEFAULT ''"],
      ["confidence", "REAL NOT NULL DEFAULT 0"],
      ["payload_json", "TEXT NOT NULL DEFAULT '{}'"],
      ["created_at", "TEXT NOT NULL DEFAULT ''"],
      ["updated_at", "TEXT NOT NULL DEFAULT ''"]
    ],
    knowledge_edges: [
      ["weight", "REAL NOT NULL DEFAULT 0"],
      ["confidence", "REAL NOT NULL DEFAULT 0"],
      ["payload_json", "TEXT NOT NULL DEFAULT '{}'"],
      ["created_at", "TEXT NOT NULL DEFAULT ''"]
    ],
    knowledge_spaces: [
      ["parent_space_id", "TEXT"],
      ["layout_type", "TEXT NOT NULL DEFAULT 'freeform'"],
      ["viewport_json", "TEXT NOT NULL DEFAULT '{}'"],
      ["payload_json", "TEXT NOT NULL DEFAULT '{}'"],
      ["created_at", "TEXT NOT NULL DEFAULT ''"],
      ["updated_at", "TEXT NOT NULL DEFAULT ''"]
    ],
    knowledge_blocks: [
      ["node_id", "TEXT"],
      ["geometry_json", "TEXT NOT NULL DEFAULT '{}'"],
      ["content_json", "TEXT NOT NULL DEFAULT '{}'"],
      ["metadata_json", "TEXT NOT NULL DEFAULT '{}'"]
    ],
    knowledge_sources: [
      ["path", "TEXT"],
      ["url", "TEXT"],
      ["metadata_json", "TEXT NOT NULL DEFAULT '{}'"]
    ],
    graph_proposals: [
      ["source_ids_json", "TEXT NOT NULL DEFAULT '[]'"],
      ["proposal_json", "TEXT NOT NULL DEFAULT '{}'"],
      ["created_at", "TEXT NOT NULL DEFAULT ''"]
    ],
    import_jobs: [
      ["file_path", "TEXT"],
      ["source_count", "INTEGER NOT NULL DEFAULT 0"],
      ["node_count", "INTEGER NOT NULL DEFAULT 0"],
      ["edge_count", "INTEGER NOT NULL DEFAULT 0"],
      ["error", "TEXT"],
      ["finished_at", "TEXT"]
    ]
  };

  for (const table of KNOWN_TABLES) {
    for (const [col, ddl] of patches[table]) {
      addColumnIfMissing(db, table, col, ddl);
    }
  }
}
