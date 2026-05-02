import type { KnowledgeBlock, KnowledgeNode, KnowledgeSpace } from "@beelite/shared";

export interface LayoutInput {
  spaceId: string;
  nodes: KnowledgeNode[];
  columns?: number;
  origin?: { x: number; y: number };
}

export function createRootSpace(): KnowledgeSpace {
  const now = new Date().toISOString();

  return {
    id: "space-root",
    title: "知识宇宙",
    description: "个人认知地图的入口空间",
    nodeIds: [],
    blockIds: [],
    layoutType: "freeform",
    viewportState: { x: 0, y: 0, zoom: 0.74 },
    semanticFocus: ["ai", "research", "knowledge"],
    createdAt: now,
    updatedAt: now
  };
}

export function mapNodesToBlocks(input: LayoutInput): KnowledgeBlock[] {
  const columns = input.columns ?? 3;
  const origin = input.origin ?? { x: -420, y: -240 };
  const gapX = 310;
  const gapY = 230;

  return input.nodes.map((node, index) => {
    const column = index % columns;
    const row = Math.floor(index / columns);

    return {
      id: `block-${node.id}`,
      type: node.type === "research" ? "research" : "knowledge",
      nodeId: node.id,
      spaceId: input.spaceId,
      x: origin.x + column * gapX + (row % 2) * 42,
      y: origin.y + row * gapY,
      width: node.type === "research" ? 330 : 270,
      height: node.type === "research" ? 210 : 190,
      rotation: index % 4 === 0 ? -1.2 : index % 5 === 0 ? 1.4 : 0,
      zIndex: index,
      content: {
        title: node.title,
        summary: node.summary,
        tags: node.tags
      },
      metadata: {
        confidence: node.confidence,
        nodeType: node.type
      }
    };
  });
}
