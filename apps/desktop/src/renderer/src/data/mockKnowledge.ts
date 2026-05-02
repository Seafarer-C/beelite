import type {
  KnowledgeBlock,
  KnowledgeEdge,
  KnowledgeNode,
  KnowledgeSpace
} from "@beelite/shared";
import { createGraphProposal } from "@beelite/graph-engine";
import { createRootSpace, mapNodesToBlocks } from "@beelite/space-engine";

const now = new Date().toISOString();

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
    spaceIds: ["space-root"],
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
    spaceIds: ["space-root"],
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
    spaceIds: ["space-root"],
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
    spaceIds: ["space-root"],
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
    spaceIds: ["space-root"],
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

const mappedBlocks = mapNodesToBlocks({
  spaceId: rootSpace.id,
  nodes: mockNodes,
  columns: 3,
  origin: { x: -480, y: -260 }
});

export const mockBlocks: KnowledgeBlock[] = [
  ...mappedBlocks,
  {
    id: "block-today",
    type: "task",
    spaceId: rootSpace.id,
    x: 420,
    y: -280,
    width: 300,
    height: 250,
    rotation: 0,
    zIndex: 12,
    content: {
      title: "Today",
      items: [
        "阅读 RAG 论文与开源项目",
        "对比 BM25 与向量检索",
        "设计行业 RAG 应用架构",
        "整理成图谱 proposal"
      ],
      checked: [true, true, false, false]
    },
    metadata: {}
  },
  {
    id: "block-rag-flow",
    type: "graph",
    spaceId: rootSpace.id,
    x: 840,
    y: -220,
    width: 420,
    height: 245,
    rotation: -1,
    zIndex: 15,
    content: {
      title: "RAG 关键流程",
      steps: ["问题理解", "检索相关文档", "增强上下文", "生成回答"]
    },
    metadata: { accent: "blue" }
  },
  {
    id: "block-visual-note",
    type: "markdown",
    spaceId: rootSpace.id,
    x: 220,
    y: 310,
    width: 310,
    height: 210,
    rotation: 0.8,
    zIndex: 10,
    content: {
      title: "图形化设计与沟通简史",
      body: "从早期图形图表到现代的信息叙事，图形化设计在不同媒介中不断形成、帮助人们理解复杂信息。"
    },
    metadata: { date: "Jul 20" }
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
