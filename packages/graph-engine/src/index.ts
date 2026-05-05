import type {
  GraphProposal,
  KnowledgeEdge,
  KnowledgeNode,
  RelationType
} from "@beelite/shared";

export const MVP_NODE_TYPES = ["topic", "concept", "research"] as const;

export const MVP_RELATION_TYPES: RelationType[] = [
  "related_to",
  "sub_topic_of",
  "supports",
  "contradicts"
];

export function createGraphProposal(input: {
  id: string;
  title: string;
  sourceIds: string[];
  nodes: KnowledgeNode[];
  edges: KnowledgeEdge[];
  openQuestions?: string[];
  warnings?: string[];
}): GraphProposal {
  return {
    id: input.id,
    title: input.title,
    status: "draft",
    createdAt: new Date().toISOString(),
    sourceIds: input.sourceIds,
    nodes: input.nodes,
    edges: input.edges,
    openQuestions: input.openQuestions ?? [],
    warnings: input.warnings ?? []
  };
}

export function confidenceBand(confidence: number): "low" | "medium" | "high" {
  if (confidence >= 0.78) return "high";
  if (confidence >= 0.52) return "medium";
  return "low";
}

export function isMvpRelationType(value: string): value is RelationType {
  return MVP_RELATION_TYPES.includes(value as RelationType);
}

export function relationLabel(relationType: RelationType): string {
  const labels: Record<RelationType, string> = {
    related_to: "相关",
    sub_topic_of: "子主题",
    supports: "支持",
    contradicts: "冲突"
  };

  return labels[relationType];
}

export {
  buildGraphOverlaySegments,
  defaultBlockIdForNode,
  filterSegmentsForNodes,
  nodeIdsFromKnowledgeNodes,
  type WorldPoint,
  type WorldSegment
} from "./overlay.js";
