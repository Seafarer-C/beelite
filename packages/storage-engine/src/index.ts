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
`;

export const STORAGE_BUCKETS = {
  imports: "imports",
  snapshots: "snapshots",
  researchCache: "research-cache",
  images: "images"
} as const;
