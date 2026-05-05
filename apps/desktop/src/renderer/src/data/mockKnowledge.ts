import type {
  KnowledgeBlock,
  KnowledgeEdge,
  KnowledgeNode,
  KnowledgeSpace
} from "@beelite/shared";
import { createGraphProposal } from "@beelite/graph-engine";
import { createRootSpace } from "@beelite/space-engine";
import knowledgeUniverseHero from "../assets/knowledge-universe-hero.png";

const now = new Date().toISOString();
const spaceId = "space-root";

export const mockNodes: KnowledgeNode[] = [
  {
    id: "node-rag",
    type: "topic",
    title: "RAG 研究与实践",
    summary: "从检索、重排、上下文压缩到答案生成，沉淀可复用的研究路径。",
    confidence: 0.86,
    importance: 0.92,
    freshness: 0.88,
    createdAt: now,
    updatedAt: now,
    sourceRefs: ["chatgpt-rag"],
    tags: ["AI", "检索", "系统设计"],
    aliases: ["Retrieval Augmented Generation"],
    relationIds: ["edge-rag-agent", "edge-rag-graph"],
    spaceIds: [spaceId],
    metadata: {}
  },
  {
    id: "node-agent",
    type: "concept",
    title: "Agent Runtime",
    summary: "本地执行研究、浏览器阅读、图谱提议和布局规划的可组合运行时。",
    confidence: 0.74,
    importance: 0.86,
    freshness: 0.91,
    createdAt: now,
    updatedAt: now,
    sourceRefs: ["tech-init"],
    tags: ["pi-mono", "tools", "runtime"],
    aliases: ["Local Agent"],
    relationIds: ["edge-rag-agent"],
    spaceIds: [spaceId],
    metadata: {}
  },
  {
    id: "node-graph",
    type: "topic",
    title: "Knowledge Graph Engine",
    summary: "节点、边、置信度、证据和 proposal mode 构成知识系统内核。",
    confidence: 0.9,
    importance: 0.96,
    freshness: 0.84,
    createdAt: now,
    updatedAt: now,
    sourceRefs: ["graph-spec"],
    tags: ["Graph", "Schema", "Confidence"],
    aliases: ["知识图谱引擎"],
    relationIds: ["edge-rag-graph"],
    spaceIds: [spaceId],
    metadata: {}
  },
  {
    id: "node-spatial",
    type: "concept",
    title: "Spatial Memory",
    summary: "空间布局必须稳定，让用户能记住知识块之间的位置关系。",
    confidence: 0.81,
    importance: 0.78,
    freshness: 0.79,
    createdAt: now,
    updatedAt: now,
    sourceRefs: ["tech-init"],
    tags: ["Whiteboard", "UX"],
    aliases: ["空间记忆"],
    relationIds: [],
    spaceIds: [spaceId],
    metadata: {}
  },
  {
    id: "node-research-question",
    type: "research",
    title: "WebGPU 会怎样改变浏览器 AI 计算？",
    summary: "需要比较 WebGPU、WebGL、WASM 与本地推理框架的边界。",
    confidence: 0.66,
    importance: 0.8,
    freshness: 0.94,
    createdAt: now,
    updatedAt: now,
    sourceRefs: ["manual-question"],
    tags: ["Research", "WebGPU", "AI"],
    aliases: [],
    relationIds: [],
    spaceIds: [spaceId],
    metadata: {}
  }
];

export const mockEdges: KnowledgeEdge[] = [
  {
    id: "edge-rag-agent",
    sourceId: "node-rag",
    targetId: "node-agent",
    relationType: "supports",
    weight: 0.72,
    confidence: 0.76,
    evidenceRefs: [{ sourceId: "tech-init", confidence: 0.72 }],
    createdBy: "ai",
    createdAt: now
  },
  {
    id: "edge-rag-graph",
    sourceId: "node-rag",
    targetId: "node-graph",
    relationType: "related_to",
    weight: 0.82,
    confidence: 0.84,
    evidenceRefs: [{ sourceId: "graph-spec", confidence: 0.8 }],
    createdBy: "ai",
    createdAt: now
  }
];

export const rootSpace: KnowledgeSpace = {
  ...createRootSpace(),
  nodeIds: mockNodes.map((node) => node.id)
};

/**
 * 参考 Spatial 风布局：任务卡、插图叠放、长文、归档夹与知识节点共存，便于验收 whiteboard-engine + 独立 overlay。
 */
export const mockBlocks: KnowledgeBlock[] = [
  {
    id: "block-note-visual",
    type: "task",
    spaceId,
    x: -660,
    y: -420,
    width: 280,
    height: 200,
    rotation: -0.6,
    zIndex: 8,
    content: {
      title: "Visual concept",
      items: ["Moodboard for Q3", "Color & type tests", "Grid vs freeform"],
      checked: [true, false, false]
    },
    metadata: {}
  },
  {
    id: "block-someday",
    type: "task",
    spaceId,
    x: -420,
    y: -480,
    width: 260,
    height: 170,
    rotation: 0.5,
    zIndex: 7,
    content: {
      title: "Some day",
      items: ["Print inspiration wall", "Archive old boards"],
      checked: [false, false]
    },
    metadata: {}
  },
  {
    id: "block-today-column",
    type: "task",
    spaceId,
    x: -740,
    y: -80,
    width: 280,
    height: 430,
    rotation: 0,
    zIndex: 11,
    content: {
      title: "Today",
      items: [
        "整理引用与摘录",
        "补全知识块链接",
        "给画布加 spatial index",
        "验收 overlay 效果",
        "写下一段长文笔记"
      ],
      checked: [true, true, true, false, false]
    },
    metadata: {}
  },
  {
    id: "block-hero-art",
    type: "image",
    spaceId,
    x: -120,
    y: -220,
    width: 520,
    height: 360,
    rotation: 0,
    zIndex: 5,
    content: {
      title: "",
      imageSrc: knowledgeUniverseHero,
      caption: "Spatial canvas reference"
    },
    metadata: { variant: "hero" }
  },
  {
    id: "block-demo-video",
    type: "video",
    spaceId,
    x: 380,
    y: -400,
    width: 320,
    height: 200,
    rotation: 0,
    zIndex: 18,
    content: {
      title: "Spatial clip",
      videoUrl:
        "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.webm"
    },
    metadata: {}
  },
  {
    id: "block-clock-overlay",
    type: "image",
    spaceId,
    x: 300,
    y: -140,
    width: 112,
    height: 112,
    rotation: 2,
    zIndex: 22,
    content: {
      title: "",
      imageSrc: "",
      placeholderColor: "#1c65ff",
      icon: "clock"
    },
    metadata: { variant: "stamp" }
  },
  {
    id: "block-car-note",
    type: "knowledge",
    spaceId,
    x: -800,
    y: 100,
    width: 300,
    height: 280,
    rotation: -1,
    zIndex: 9,
    content: {
      title: "Drive notes",
      summary: "路上的想法先丢在这里，回家再整理进主题空间。",
      heroImage:
        "https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?w=600&q=80&auto=format&fit=crop"
    },
    metadata: { layout: "media-header" }
  },
  {
    id: "block-archive-folder",
    type: "knowledge",
    spaceId,
    x: -700,
    y: 400,
    width: 260,
    height: 148,
    rotation: 0,
    zIndex: 12,
    content: {
      title: "Archived notes",
      summary: "3 items · August 2025",
      tags: ["Archive"]
    },
    metadata: { variant: "folder", folderCount: 3 }
  },
  {
    id: "block-history-md",
    type: "markdown",
    spaceId,
    x: 400,
    y: -300,
    width: 300,
    height: 340,
    rotation: 0,
    zIndex: 6,
    content: {
      title: "A brief history of visual thinking",
      body:
        "人们很早就学会用图像补充语言：地图、图表与示意图降低了协作成本。数字画布把这一过程推向极致——任意叠放、缩放与批注，让思考不必先收敛成线性大纲。\n\n在知识工作中，重要的往往不是「放在哪个文件夹」，而是「它和谁相邻」。空间记忆提供了第二条检索路径。",
      highlights: ["空间记忆", "任意叠放"]
    },
    metadata: { dateLabel: "Jul 20" }
  },
  {
    id: "block-spatial-md",
    type: "markdown",
    spaceId,
    x: 400,
    y: 80,
    width: 300,
    height: 300,
    rotation: 0,
    zIndex: 6,
    content: {
      title: "Spatial organisation",
      body:
        "标签与目录擅长分类，却不擅长表达「此刻的相关性」。画布上的邻近关系是一种弱链接：它可随项目演进重排，而不破坏文档本身。\n\n把摘录、网页剪藏与长文草稿放在同一视域里，你会更容易发现缺口与重复。",
      highlights: ["弱链接", "网页剪藏"]
    },
    metadata: { dateLabel: "Aug 2" }
  },
  {
    id: "block-node-rag",
    type: "knowledge",
    nodeId: "node-rag",
    spaceId,
    x: 80,
    y: 200,
    width: 280,
    height: 200,
    rotation: 0,
    zIndex: 16,
    content: {
      title: mockNodes[0].title,
      summary: mockNodes[0].summary,
      tags: mockNodes[0].tags
    },
    metadata: { confidence: mockNodes[0].confidence, nodeType: mockNodes[0].type }
  },
  {
    id: "block-node-agent",
    type: "knowledge",
    nodeId: "node-agent",
    spaceId,
    x: 460,
    y: 260,
    width: 270,
    height: 190,
    rotation: 0,
    zIndex: 14,
    content: {
      title: mockNodes[1].title,
      summary: mockNodes[1].summary,
      tags: mockNodes[1].tags
    },
    metadata: { confidence: mockNodes[1].confidence, nodeType: mockNodes[1].type }
  },
  {
    id: "block-node-graph",
    type: "knowledge",
    nodeId: "node-graph",
    spaceId,
    x: 140,
    y: -520,
    width: 290,
    height: 200,
    rotation: 1.2,
    zIndex: 15,
    content: {
      title: mockNodes[2].title,
      summary: mockNodes[2].summary,
      tags: mockNodes[2].tags
    },
    metadata: { confidence: mockNodes[2].confidence, nodeType: mockNodes[2].type }
  },
  {
    id: "block-node-spatial",
    type: "knowledge",
    nodeId: "node-spatial",
    spaceId,
    x: -200,
    y: 220,
    width: 260,
    height: 190,
    rotation: -1,
    zIndex: 10,
    content: {
      title: mockNodes[3].title,
      summary: mockNodes[3].summary,
      tags: mockNodes[3].tags
    },
    metadata: { confidence: mockNodes[3].confidence, nodeType: mockNodes[3].type }
  },
  {
    id: "block-node-research",
    type: "research",
    nodeId: "node-research-question",
    spaceId,
    x: 620,
    y: -120,
    width: 320,
    height: 220,
    rotation: 0,
    zIndex: 17,
    content: {
      title: mockNodes[4].title,
      summary: mockNodes[4].summary,
      tags: mockNodes[4].tags
    },
    metadata: { confidence: mockNodes[4].confidence, nodeType: mockNodes[4].type }
  }
];

export const mockProposal = createGraphProposal({
  id: "proposal-rag-001",
  title: "RAG 知识结构初稿",
  sourceIds: ["chatgpt-rag", "graph-spec"],
  nodes: mockNodes.slice(0, 3),
  edges: mockEdges,
  openQuestions: ["RAG 与 Agentic Research 的边界如何定义？"],
  warnings: ["2 条关系来自单一来源，需要二次验证。"]
});
