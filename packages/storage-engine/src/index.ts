export const INITIAL_SQLITE_SCHEMA = `
CREATE TABLE IF NOT EXISTS knowledge_nodes (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  summary TEXT NOT NULL,
  confidence REAL NOT NULL,
  payload_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS knowledge_sources (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  path TEXT,
  url TEXT,
  imported_at TEXT NOT NULL,
  metadata_json TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS knowledge_edges (
  id TEXT PRIMARY KEY,
  source_id TEXT NOT NULL,
  target_id TEXT NOT NULL,
  relation_type TEXT NOT NULL,
  weight REAL NOT NULL,
  confidence REAL NOT NULL,
  payload_json TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS knowledge_spaces (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  parent_space_id TEXT,
  layout_type TEXT NOT NULL,
  viewport_json TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS knowledge_blocks (
  id TEXT PRIMARY KEY,
  space_id TEXT NOT NULL,
  node_id TEXT,
  type TEXT NOT NULL,
  geometry_json TEXT NOT NULL,
  content_json TEXT NOT NULL,
  metadata_json TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS graph_proposals (
  id TEXT PRIMARY KEY,
  status TEXT NOT NULL,
  title TEXT NOT NULL,
  source_ids_json TEXT NOT NULL,
  proposal_json TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS import_jobs (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL,
  status TEXT NOT NULL,
  file_path TEXT,
  source_count INTEGER NOT NULL DEFAULT 0,
  node_count INTEGER NOT NULL DEFAULT 0,
  edge_count INTEGER NOT NULL DEFAULT 0,
  error TEXT,
  started_at TEXT NOT NULL,
  finished_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_sources_type ON knowledge_sources(type);
CREATE INDEX IF NOT EXISTS idx_nodes_type ON knowledge_nodes(type);
CREATE INDEX IF NOT EXISTS idx_edges_source ON knowledge_edges(source_id);
CREATE INDEX IF NOT EXISTS idx_edges_target ON knowledge_edges(target_id);
CREATE INDEX IF NOT EXISTS idx_import_jobs_started ON import_jobs(started_at);

CREATE TABLE IF NOT EXISTS llm_provider_settings (
  provider_id TEXT PRIMARY KEY,
  api_key TEXT,
  base_url TEXT,
  model TEXT
);

CREATE TABLE IF NOT EXISTS research_search_settings (
  singleton INTEGER PRIMARY KEY CHECK (singleton = 1),
  provider TEXT NOT NULL DEFAULT 'brave',
  api_key TEXT
);
`;

export const STORAGE_BUCKETS = {
  imports: "imports",
  snapshots: "snapshots",
  researchCache: "research-cache",
  images: "images"
} as const;

export * from "./repository";
