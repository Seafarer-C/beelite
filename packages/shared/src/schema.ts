export type NodeType = "topic" | "concept" | "research";

export type RelationType =
  | "related_to"
  | "sub_topic_of"
  | "supports"
  | "contradicts";

export type BlockType =
  | "markdown"
  | "knowledge"
  | "research"
  | "graph"
  | "image"
  | "video"
  | "task";

export type SourceType =
  | "chatgpt_conversation"
  | "browser_bookmark"
  | "browser_folder"
  | "research_source"
  | "manual";

export type ImportKind = "chatgpt" | "browser_bookmarks";

export type ProposalStatus = "draft" | "accepted" | "rejected";

export interface EvidenceRef {
  sourceId: string;
  quote?: string;
  url?: string;
  confidence: number;
}

export interface KnowledgeNode {
  id: string;
  type: NodeType;
  title: string;
  summary: string;
  content?: string;
  confidence: number;
  importance: number;
  freshness: number;
  createdAt: string;
  updatedAt: string;
  sourceRefs: string[];
  tags: string[];
  aliases: string[];
  relationIds: string[];
  spaceIds: string[];
  metadata: Record<string, unknown>;
}

export interface KnowledgeEdge {
  id: string;
  sourceId: string;
  targetId: string;
  relationType: RelationType;
  weight: number;
  confidence: number;
  evidenceRefs: EvidenceRef[];
  createdBy: "ai" | "user" | "system";
  createdAt: string;
}

export interface KnowledgeSource {
  id: string;
  type: SourceType;
  title: string;
  path?: string;
  url?: string;
  importedAt: string;
  metadata: Record<string, unknown>;
}

export interface ImportJob {
  id: string;
  kind: ImportKind;
  status: "running" | "completed" | "failed";
  filePath?: string;
  sourceCount: number;
  nodeCount: number;
  edgeCount: number;
  error?: string;
  startedAt: string;
  finishedAt?: string;
}

export interface ImportStats {
  sources: number;
  nodes: number;
  edges: number;
  spaces: number;
  blocks: number;
  proposals: number;
  importJobs: number;
}

export interface ImportRunResult {
  job: ImportJob;
  stats: ImportStats;
  preview: {
    sources: KnowledgeSource[];
    nodes: KnowledgeNode[];
    edges: KnowledgeEdge[];
  };
}

export interface KnowledgeBlock {
  id: string;
  type: BlockType;
  nodeId?: string;
  spaceId: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  zIndex: number;
  content: Record<string, unknown>;
  metadata: Record<string, unknown>;
}

export interface KnowledgeSpace {
  id: string;
  title: string;
  description: string;
  parentSpaceId?: string;
  nodeIds: string[];
  blockIds: string[];
  layoutType: "freeform" | "cluster" | "mindmap" | "timeline" | "research";
  viewportState: ViewportState;
  semanticFocus: string[];
  createdAt: string;
  updatedAt: string;
}

export interface ViewportState {
  x: number;
  y: number;
  zoom: number;
}

export interface GraphProposal {
  id: string;
  title: string;
  status: ProposalStatus;
  createdAt: string;
  sourceIds: string[];
  nodes: KnowledgeNode[];
  edges: KnowledgeEdge[];
  openQuestions: string[];
  warnings: string[];
}

export interface ResearchThread {
  id: string;
  question: string;
  status: "queued" | "running" | "synthesized" | "failed";
  budget: ResearchBudget;
  claims: ResearchClaim[];
  unknowns: string[];
  openQuestions: string[];
  createdAt: string;
  updatedAt: string;
}

export interface ResearchBudget {
  maxSearches: number;
  maxPages: number;
  maxTokens: number;
  depth: "quick" | "standard" | "deep";
}

export interface ResearchClaim {
  id: string;
  text: string;
  confidence: number;
  evidenceRefs: EvidenceRef[];
  counterArguments: string[];
}

/** Main-process workspace bundle for renderer sync */
export interface WorkspaceSnapshot {
  spaces: KnowledgeSpace[];
  blocks: KnowledgeBlock[];
  nodes: KnowledgeNode[];
  edges: KnowledgeEdge[];
  proposal: GraphProposal | null;
}
