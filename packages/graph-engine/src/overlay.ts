import type { KnowledgeBlock, KnowledgeEdge, KnowledgeNode } from "@beelite/shared";

/** Matches {@link space-engine} / desktop convention `block-${nodeId}`. */
export function defaultBlockIdForNode(nodeId: string): string {
  return `block-${nodeId}`;
}

export interface WorldPoint {
  x: number;
  y: number;
}

export interface WorldSegment {
  id: string;
  from: WorldPoint;
  to: WorldPoint;
  relationType: KnowledgeEdge["relationType"];
}

/**
 * Build world-space edge segments for an **independent** SVG/Canvas overlay.
 * Endpoints use block **centers** in world coordinates.
 */
export function buildGraphOverlaySegments(
  edges: readonly KnowledgeEdge[],
  blocks: readonly KnowledgeBlock[]
): WorldSegment[] {
  const byNode = new Map<string, KnowledgeBlock>();
  for (const b of blocks) {
    if (b.nodeId) {
      byNode.set(b.nodeId, b);
    }
  }

  const out: WorldSegment[] = [];
  for (const e of edges) {
    const a = byNode.get(e.sourceId);
    const b = byNode.get(e.targetId);
    if (!a || !b) continue;
    out.push({
      id: e.id,
      relationType: e.relationType,
      from: { x: a.x + a.width / 2, y: a.y + a.height / 2 },
      to: { x: b.x + b.width / 2, y: b.y + b.height / 2 }
    });
  }
  return out;
}

/**
 * When the board is large, only draw edges that cross the current world rect.
 * `nodeIds` is the set of visible-on-board nodes from viewport culling if desired.
 */
export function filterSegmentsForNodes(
  segments: readonly WorldSegment[],
  edges: readonly KnowledgeEdge[],
  relevantNodeIds: ReadonlySet<string>
): WorldSegment[] {
  const edgeIds = new Set<string>();
  for (const e of edges) {
    if (relevantNodeIds.has(e.sourceId) && relevantNodeIds.has(e.targetId)) {
      edgeIds.add(e.id);
    }
  }
  return segments.filter((s) => edgeIds.has(s.id));
}

export function nodeIdsFromKnowledgeNodes(nodes: readonly KnowledgeNode[]): Set<string> {
  return new Set(nodes.map((n) => n.id));
}
