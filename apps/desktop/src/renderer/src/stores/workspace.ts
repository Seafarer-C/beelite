import { defineStore } from "pinia";
import { computed, ref, toRaw } from "vue";
import { PROVIDER_TEMPLATES, DEFAULT_MODEL_ROUTES } from "@beelite/llm-engine";
import type {
  BlockType,
  ImportJob,
  ImportRunResult,
  ImportStats,
  KnowledgeBlock,
  KnowledgeEdge,
  KnowledgeNode,
  KnowledgeSpace,
  KnowledgeSource,
  LlmSettingsPublic,
  ResearchFetchPageParams,
  ResearchFetchPageResult,
  ResearchSearchParams,
  ResearchSearchResult,
  ResearchSettingsPublic,
  ViewportState,
  WorkspaceSnapshot
} from "@beelite/shared";
import { createRootSpace } from "@beelite/space-engine";
import {
  clampZoom,
  computeBoardLayoutPositions,
  computeViewportFitToBlocks,
  type BoardLayoutPresetId
} from "@beelite/whiteboard-engine";
import {
  mockBlocks,
  mockEdges,
  mockNodes,
  mockProposal,
  rootSpace
} from "../data/mockKnowledge";

export type { BoardLayoutPresetId } from "@beelite/whiteboard-engine";

export type CanvasTool =
  | "hand"
  | "select"
  | "add-task"
  | "add-knowledge"
  | "add-markdown"
  | "add-research"
  | "add-graph"
  | "add-image"
  | "add-video"
  | "add-folder";

function newBlockId(): string {
  return `block-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
}

/** 将工具栏「添加」工具映射为画布块类型 */
export function blockTypeFromAddTool(tool: CanvasTool): BlockType | null {
  switch (tool) {
    case "add-task":
      return "task";
    case "add-knowledge":
      return "knowledge";
    case "add-markdown":
      return "markdown";
    case "add-research":
      return "research";
    case "add-graph":
      return "graph";
    case "add-image":
      return "image";
    case "add-video":
      return "video";
    case "add-folder":
      return null;
    default:
      return null;
  }
}

export function isAddTool(tool: CanvasTool): boolean {
  return tool.startsWith("add-");
}

export function isFolderKnowledgeBlock(block: KnowledgeBlock): boolean {
  return block.type === "knowledge" && block.metadata?.variant === "folder";
}

/** 画布文件夹卡片固定尺寸（与 KnowledgeCard 文件夹样式一致） */
export const FOLDER_CARD_WIDTH = 260;
export const FOLDER_CARD_HEIGHT = 148;

/** 归入文件夹的画布块：指向父文件夹 block id */
export function blockParentFolderId(block: KnowledgeBlock): string | null {
  const p = block.metadata?.parentFolderId;
  return typeof p === "string" ? p : null;
}

/** 文件夹显式子节点列表（与几何落点无关）；存在空数组时表示「显式模式但暂无子项」 */
export function folderHasExplicitChildList(folder: KnowledgeBlock): boolean {
  return Array.isArray(folder.metadata?.childBlockIds);
}

export function folderChildBlockIdsList(folder: KnowledgeBlock): string[] {
  const raw = folder.metadata?.childBlockIds;
  if (!Array.isArray(raw)) return [];
  return raw.filter((x): x is string => typeof x === "string");
}

/** 画布撤销栈中保存的快照（与画布块、视口、选区等相关） */
export interface CanvasHistorySnapshot {
  blocks: KnowledgeBlock[];
  edges: KnowledgeEdge[];
  spaces: KnowledgeSpace[];
  nodes: KnowledgeNode[];
  viewport: ViewportState;
  selectedBlockIds: string[];
  focusedFolderBlockId: string | null;
  activeTool: CanvasTool;
  activeSpaceId: string;
}

const MAX_CANVAS_HISTORY = 60;

/** 画布历史深拷贝：去 Proxy 后 structuredClone，失败则用 JSON（避免 DataCloneError） */
function deepCloneForCanvasHistory<T>(value: T): T {
  const raw = toRaw(value) as T;
  try {
    return structuredClone(raw);
  } catch {
    return JSON.parse(JSON.stringify(raw)) as T;
  }
}

export const useWorkspaceStore = defineStore("workspace", () => {
  const nodes = ref<KnowledgeNode[]>(mockNodes);
  const edges = ref<KnowledgeEdge[]>(mockEdges);
  const spaces = ref<KnowledgeSpace[]>([{ ...rootSpace, nodeIds: mockNodes.map((n) => n.id) }]);
  const blocks = ref<KnowledgeBlock[]>([...mockBlocks]);
  const activeSpaceId = ref(rootSpace.id);
  const activeTool = ref<CanvasTool>("select");
  const selectedBlockIds = ref<string[]>(["block-hero-art"]);
  const viewport = ref<ViewportState>({ x: 600, y: 420, zoom: 0.5 });
  /** 画布 DOM 像素尺寸，供「缩放到可见」等计算使用（由 KnowledgeCanvas 同步） */
  const canvasPixelSize = ref({ width: 1200, height: 800 });
  const graphProposal = ref(mockProposal);
  const importStats = ref<ImportStats | null>(null);
  const importJobs = ref<ImportJob[]>([]);
  const importSources = ref<KnowledgeSource[]>([]);
  const lastImportResult = ref<ImportRunResult | null>(null);
  const importError = ref<string | null>(null);
  const importLoading = ref(false);
  /** True when canvas data comes from SQLite (imported knowledge), not demo mocks */
  const useLiveWorkspace = ref(false);
  const llmSettings = ref<LlmSettingsPublic | null>(null);
  const researchSettings = ref<ResearchSettingsPublic | null>(null);
  const modelSettingsOpen = ref(false);
  /** 画布上点击图片 / 视频 / Markdown 后的全屏预览（参见 Spatial 交互） */
  const previewBlockId = ref<string | null>(null);
  /** 文件夹聚焦：蒙层下的主体文件夹块 id */
  const focusedFolderBlockId = ref<string | null>(null);

  const canvasUndoStack = ref<CanvasHistorySnapshot[]>([]);
  const canvasRedoStack = ref<CanvasHistorySnapshot[]>([]);
  let isApplyingCanvasHistory = false;
  let canvasHistoryGroupDepth = 0;
  /** 与 begin/end 嵌套对齐：每一层分组至多压入一条快照 */
  const canvasHistoryGroupPushedStack: boolean[] = [];

  const canvasCanUndo = computed(() => canvasUndoStack.value.length > 0);
  const canvasCanRedo = computed(() => canvasRedoStack.value.length > 0);

  function captureCanvasSnapshot(): CanvasHistorySnapshot {
    return {
      blocks: deepCloneForCanvasHistory(blocks.value),
      edges: deepCloneForCanvasHistory(edges.value),
      spaces: deepCloneForCanvasHistory(spaces.value),
      nodes: deepCloneForCanvasHistory(nodes.value),
      viewport: { ...viewport.value },
      selectedBlockIds: [...selectedBlockIds.value],
      focusedFolderBlockId: focusedFolderBlockId.value,
      activeTool: activeTool.value,
      activeSpaceId: activeSpaceId.value
    };
  }

  function applyCanvasSnapshot(snapshot: CanvasHistorySnapshot): void {
    isApplyingCanvasHistory = true;
    try {
      blocks.value = deepCloneForCanvasHistory(snapshot.blocks);
      edges.value = deepCloneForCanvasHistory(snapshot.edges);
      spaces.value = deepCloneForCanvasHistory(snapshot.spaces);
      nodes.value = deepCloneForCanvasHistory(snapshot.nodes);
      viewport.value = { ...snapshot.viewport };
      selectedBlockIds.value = [...snapshot.selectedBlockIds];
      focusedFolderBlockId.value = snapshot.focusedFolderBlockId;
      activeTool.value = snapshot.activeTool;
      activeSpaceId.value = snapshot.activeSpaceId;
      previewBlockId.value = null;
    } finally {
      isApplyingCanvasHistory = false;
    }
  }

  function clearCanvasHistory(): void {
    canvasUndoStack.value = [];
    canvasRedoStack.value = [];
    canvasHistoryGroupDepth = 0;
    canvasHistoryGroupPushedStack.length = 0;
  }

  /** 与「平移 / 拖拽 / 缩放边」等多帧操作合并为一条历史：先 begin，再多次 mutate，最后 end */
  function beginCanvasHistoryGroup(): void {
    canvasHistoryGroupDepth++;
    canvasHistoryGroupPushedStack.push(false);
  }

  function endCanvasHistoryGroup(): void {
    canvasHistoryGroupDepth = Math.max(0, canvasHistoryGroupDepth - 1);
    canvasHistoryGroupPushedStack.pop();
  }

  /** 在变更画布状态之前调用：把当前状态压入撤销栈（分组内仅压一次） */
  function pushCanvasHistory(): void {
    if (isApplyingCanvasHistory) return;
    if (canvasHistoryGroupDepth > 0) {
      const top = canvasHistoryGroupPushedStack.length - 1;
      if (top >= 0 && !canvasHistoryGroupPushedStack[top]) {
        canvasRedoStack.value = [];
        canvasUndoStack.value.push(captureCanvasSnapshot());
        if (canvasUndoStack.value.length > MAX_CANVAS_HISTORY) {
          canvasUndoStack.value.shift();
        }
        canvasHistoryGroupPushedStack[top] = true;
      }
      return;
    }
    canvasRedoStack.value = [];
    canvasUndoStack.value.push(captureCanvasSnapshot());
    if (canvasUndoStack.value.length > MAX_CANVAS_HISTORY) {
      canvasUndoStack.value.shift();
    }
  }

  function undoCanvas(): boolean {
    if (canvasUndoStack.value.length === 0) return false;
    canvasRedoStack.value.push(captureCanvasSnapshot());
    const snap = canvasUndoStack.value.pop()!;
    applyCanvasSnapshot(snap);
    return true;
  }

  function redoCanvas(): boolean {
    if (canvasRedoStack.value.length === 0) return false;
    canvasUndoStack.value.push(captureCanvasSnapshot());
    const snap = canvasRedoStack.value.pop()!;
    applyCanvasSnapshot(snap);
    return true;
  }

  const activeSpace = computed(() =>
    spaces.value.find((space) => space.id === activeSpaceId.value) ?? spaces.value[0]
  );

  const breadcrumbTrail = computed((): KnowledgeSpace[] => {
    const byId = new Map(spaces.value.map((s) => [s.id, s]));
    const chain: KnowledgeSpace[] = [];
    let current: KnowledgeSpace | undefined =
      spaces.value.find((s) => s.id === activeSpaceId.value) ?? spaces.value[0];

    while (current) {
      chain.unshift(current);
      current = current.parentSpaceId ? byId.get(current.parentSpaceId) : undefined;
    }
    return chain;
  });

  const selectedBlock = computed(() =>
    blocks.value.find((block) => block.id === selectedBlockIds.value[0]) ?? null
  );

  const selectionCount = computed(() => selectedBlockIds.value.length);

  const hasMultiSelection = computed(() => selectedBlockIds.value.length > 1);

  const activeModelRoutes = computed(
    () => llmSettings.value?.routes ?? DEFAULT_MODEL_ROUTES
  );
  const providerTemplates = computed(() => PROVIDER_TEMPLATES);

  function resetDemoWorkspace(): void {
    nodes.value = mockNodes;
    edges.value = mockEdges;
    spaces.value = [{ ...rootSpace, nodeIds: mockNodes.map((n) => n.id) }];
    blocks.value = [...mockBlocks];
    activeSpaceId.value = rootSpace.id;
    graphProposal.value = mockProposal;
    selectedBlockIds.value = ["block-hero-art"];
    focusedFolderBlockId.value = null;
    useLiveWorkspace.value = false;
    clearCanvasHistory();
  }

  function applyLiveSnapshot(snapshot: WorkspaceSnapshot): void {
    clearCanvasHistory();
    const fallbackRoot = createRootSpace();
    spaces.value = snapshot.spaces.length > 0 ? snapshot.spaces : [fallbackRoot];
    nodes.value = snapshot.nodes;
    edges.value = snapshot.edges;
    blocks.value = snapshot.blocks;

    const preferredId = activeSpaceId.value;
    const nextSpace =
      spaces.value.find((s) => s.id === preferredId) ?? spaces.value.find((s) => s.id === "space-root");
    activeSpaceId.value = nextSpace?.id ?? spaces.value[0]?.id ?? fallbackRoot.id;

    graphProposal.value = snapshot.proposal ?? mockProposal;
    useLiveWorkspace.value = snapshot.nodes.length > 0;
    selectedBlockIds.value = snapshot.blocks[0]?.id ? [snapshot.blocks[0].id] : [];
    focusedFolderBlockId.value = null;
  }

  function setTool(tool: CanvasTool): void {
    activeTool.value = tool;
  }

  function syncActiveSpaceBlockIds(): void {
    const sid = activeSpaceId.value;
    const si = spaces.value.findIndex((s) => s.id === sid);
    if (si === -1) return;
    const ids = blocks.value.filter((b) => b.spaceId === sid).map((b) => b.id);
    const sp = spaces.value[si];
    spaces.value[si] = { ...sp, blockIds: ids, nodeIds: sp.nodeIds };
  }

  function selectBlock(blockId: string | null, options?: { additive?: boolean }): void {
    if (blockId === null) {
      if (!isApplyingCanvasHistory && selectedBlockIds.value.length > 0) {
        pushCanvasHistory();
      }
      selectedBlockIds.value = [];
      previewBlockId.value = null;
      return;
    }
    if (options?.additive) {
      const cur = new Set(selectedBlockIds.value);
      if (cur.has(blockId)) cur.delete(blockId);
      else cur.add(blockId);
      selectedBlockIds.value = [...cur];
    } else {
      selectedBlockIds.value = [blockId];
    }
    if (selectedBlockIds.value.length !== 1) {
      previewBlockId.value = null;
    }
  }

  function setSelectedBlocks(ids: string[]): void {
    if (!isApplyingCanvasHistory) {
      pushCanvasHistory();
    }
    selectedBlockIds.value = [...ids];
    if (ids.length !== 1) previewBlockId.value = null;
  }

  function clearSelection(): void {
    selectBlock(null);
  }

  /** 世界坐标增量（已将屏幕位移除以 zoom）。 */
  function moveBlockBy(blockId: string, deltaWorldX: number, deltaWorldY: number): void {
    moveBlocksBy([blockId], deltaWorldX, deltaWorldY);
  }

  function moveBlocksBy(ids: string[], deltaWorldX: number, deltaWorldY: number): void {
    if (ids.length === 0) return;
    pushCanvasHistory();
    const idSet = new Set(ids);
    blocks.value = blocks.value.map((b) =>
      idSet.has(b.id)
        ? { ...b, x: b.x + deltaWorldX, y: b.y + deltaWorldY }
        : b
    );
  }

  /** 删除文件夹时一并收集其显式子树（含嵌套文件夹）内全部块 id */
  function expandRemovalIdsWithFolderTrees(ids: readonly string[]): Set<string> {
    const all = blocks.value;
    const result = new Set<string>();

    function walkFolderTree(fid: string): void {
      const b = all.find((x) => x.id === fid);
      if (!b) return;
      result.add(fid);
      if (!isFolderKnowledgeBlock(b) || !folderHasExplicitChildList(b)) return;
      for (const cid of folderChildBlockIdsList(b)) {
        walkFolderTree(cid);
      }
    }

    for (const id of ids) {
      const b = all.find((x) => x.id === id);
      if (b && isFolderKnowledgeBlock(b)) {
        walkFolderTree(id);
      } else {
        result.add(id);
      }
    }
    return result;
  }

  function removeBlocks(ids: string[]): void {
    if (ids.length === 0) return;
    pushCanvasHistory();
    const idSet = expandRemovalIdsWithFolderTrees(ids);

    let next = blocks.value.map((b) => {
      const p = blockParentFolderId(b);
      if (p && idSet.has(p)) {
        const meta = { ...b.metadata };
        delete meta.parentFolderId;
        return { ...b, metadata: meta };
      }
      return b;
    });

    next = next.map((b) => {
      if (!isFolderKnowledgeBlock(b) || !folderHasExplicitChildList(b)) return b;
      const list = folderChildBlockIdsList(b);
      const filtered = list.filter((cid) => !idSet.has(cid));
      if (filtered.length === list.length) return b;
      return {
        ...b,
        metadata: { ...b.metadata, childBlockIds: filtered, folderCount: filtered.length }
      };
    });

    blocks.value = next.filter((b) => !idSet.has(b.id));
    selectedBlockIds.value = selectedBlockIds.value.filter((id) => !idSet.has(id));
    if (previewBlockId.value && idSet.has(previewBlockId.value)) {
      previewBlockId.value = null;
    }
    if (focusedFolderBlockId.value && idSet.has(focusedFolderBlockId.value)) {
      focusedFolderBlockId.value = null;
    }
    syncActiveSpaceBlockIds();
  }

  function removeSelectedBlocks(): void {
    removeBlocks([...selectedBlockIds.value]);
  }

  const MIN_BLOCK_W = 120;
  const MIN_BLOCK_H = 80;

  function resizeBlockEdge(
    blockId: string,
    edge: "n" | "s" | "e" | "w",
    dWorldX: number,
    dWorldY: number
  ): void {
    const i = blocks.value.findIndex((b) => b.id === blockId);
    if (i === -1) return;
    const b = blocks.value[i];
    if (isFolderKnowledgeBlock(b)) return;
    if (blockParentFolderId(b)) return;
    pushCanvasHistory();
    let { x, y, width, height } = b;
    switch (edge) {
      case "e":
        width = Math.max(MIN_BLOCK_W, width + dWorldX);
        break;
      case "w": {
        const nw = Math.max(MIN_BLOCK_W, width - dWorldX);
        x += width - nw;
        width = nw;
        break;
      }
      case "s":
        height = Math.max(MIN_BLOCK_H, height + dWorldY);
        break;
      case "n": {
        const nh = Math.max(MIN_BLOCK_H, height - dWorldY);
        y += height - nh;
        height = nh;
        break;
      }
    }
    blocks.value[i] = { ...b, x, y, width, height };
  }

  function nextZIndex(): number {
    let z = 0;
    for (const b of blocks.value) z = Math.max(z, b.zIndex);
    return z + 1;
  }

  function createBlockSkeleton(type: BlockType, cx: number, cy: number): KnowledgeBlock {
    const spaceId = activeSpaceId.value;
    const z = nextZIndex();
    const id = newBlockId();
    const base = {
      id,
      spaceId,
      rotation: 0,
      zIndex: z,
      metadata: {} as Record<string, unknown>
    };

    switch (type) {
      case "task":
        return {
          ...base,
          type,
          x: cx - 140,
          y: cy - 100,
          width: 280,
          height: 200,
          content: { title: "新任务", items: ["第一条"], checked: [false] }
        };
      case "knowledge":
        return {
          ...base,
          type,
          x: cx - 140,
          y: cy - 100,
          width: 280,
          height: 200,
          content: { title: "新笔记", summary: "在此输入摘要…", tags: [] }
        };
      case "markdown":
        return {
          ...base,
          type,
          x: cx - 150,
          y: cy - 140,
          width: 300,
          height: 280,
          content: { title: "未命名", body: "", highlights: [] }
        };
      case "research":
        return {
          ...base,
          type,
          x: cx - 160,
          y: cy - 110,
          width: 320,
          height: 220,
          content: { title: "研究问题", summary: "描述你要验证的命题…", tags: ["Research"] },
          metadata: { confidence: 0.65, nodeType: "research" }
        };
      case "graph":
        return {
          ...base,
          type,
          x: cx - 150,
          y: cy - 110,
          width: 300,
          height: 220,
          content: { title: "流程", steps: ["步骤 1", "步骤 2"] }
        };
      case "image":
        return {
          ...base,
          type,
          x: cx - 160,
          y: cy - 100,
          width: 320,
          height: 200,
          content: { title: "", imageSrc: "", caption: "" },
          metadata: { variant: "hero" }
        };
      case "video":
        return {
          ...base,
          type,
          x: cx - 160,
          y: cy - 100,
          width: 320,
          height: 200,
          content: { title: "视频", videoUrl: "" }
        };
      default:
        return {
          ...base,
          type: "knowledge",
          x: cx - 140,
          y: cy - 100,
          width: 280,
          height: 200,
          content: { title: "新笔记", summary: "", tags: [] }
        };
    }
  }

  function addBlockAtCenter(type: BlockType, centerWorldX: number, centerWorldY: number): KnowledgeBlock {
    pushCanvasHistory();
    const block = createBlockSkeleton(type, centerWorldX, centerWorldY);
    blocks.value = [...blocks.value, block];
    syncActiveSpaceBlockIds();
    selectedBlockIds.value = [block.id];
    previewBlockId.value = null;
    return block;
  }

  /** 空白处放置「文件夹」样式知识夹卡片 */
  function addFolderCardAtCenter(centerWorldX: number, centerWorldY: number): KnowledgeBlock {
    pushCanvasHistory();
    const z = nextZIndex();
    const id = newBlockId();
    const block: KnowledgeBlock = {
      id,
      type: "knowledge",
      spaceId: activeSpaceId.value,
      x: centerWorldX - FOLDER_CARD_WIDTH / 2,
      y: centerWorldY - FOLDER_CARD_HEIGHT / 2,
      width: FOLDER_CARD_WIDTH,
      height: FOLDER_CARD_HEIGHT,
      rotation: 0,
      zIndex: z,
      content: {
        title: "新建文件夹",
        summary: "拖入或归组内容",
        tags: ["Folder"]
      },
      metadata: { variant: "folder", folderCount: 0, childBlockIds: [] }
    };
    blocks.value = [...blocks.value, block];
    syncActiveSpaceBlockIds();
    selectedBlockIds.value = [block.id];
    previewBlockId.value = null;
    return block;
  }

  function groupSelectionIntoFolder(): void {
    const ids = [...selectedBlockIds.value];
    if (ids.length < 2) return;
    const selected = blocks.value.filter((b) => ids.includes(b.id));
    if (selected.length < 2) return;
    pushCanvasHistory();

    const idSet = new Set(ids);

    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const b of selected) {
      minX = Math.min(minX, b.x);
      minY = Math.min(minY, b.y);
      maxX = Math.max(maxX, b.x + b.width);
      maxY = Math.max(maxY, b.y + b.height);
    }
    const folderId = newBlockId();
    let maxZ = 0;
    for (const b of selected) maxZ = Math.max(maxZ, b.zIndex);
    const folderZ = maxZ + 1;
    const cx = (minX + maxX) / 2;
    const cy = (minY + maxY) / 2;
    const folderBlock: KnowledgeBlock = {
      id: folderId,
      type: "knowledge",
      spaceId: activeSpaceId.value,
      x: cx - FOLDER_CARD_WIDTH / 2,
      y: cy - FOLDER_CARD_HEIGHT / 2,
      width: FOLDER_CARD_WIDTH,
      height: FOLDER_CARD_HEIGHT,
      rotation: 0,
      zIndex: folderZ,
      content: {
        title: `${selected.length} 项`,
        summary: "由画布归组生成",
        tags: ["Folder"]
      },
      metadata: {
        variant: "folder",
        folderCount: selected.length,
        childBlockIds: [...ids]
      }
    };

    // 从其它文件夹列表中移除这些块，再挂到新文件夹下
    let next = blocks.value.map((b) => {
      if (!isFolderKnowledgeBlock(b) || !folderHasExplicitChildList(b)) return b;
      const list = folderChildBlockIdsList(b);
      const filtered = list.filter((cid) => !idSet.has(cid));
      if (filtered.length === list.length) return b;
      return {
        ...b,
        metadata: { ...b.metadata, childBlockIds: filtered, folderCount: filtered.length }
      };
    });

    next = next.map((b) => {
      if (!idSet.has(b.id)) return b;
      return {
        ...b,
        metadata: { ...b.metadata, parentFolderId: folderId }
      };
    });

    blocks.value = [...next, folderBlock];
    syncActiveSpaceBlockIds();
    selectedBlockIds.value = [folderId];
    previewBlockId.value = null;
  }

  function updateBlockBody(blockId: string, body: string): void {
    const i = blocks.value.findIndex((b) => b.id === blockId);
    if (i === -1) return;
    pushCanvasHistory();
    const b = blocks.value[i];
    blocks.value[i] = {
      ...b,
      content: { ...b.content, body }
    };
  }

  function panBy(deltaX: number, deltaY: number): void {
    if (deltaX === 0 && deltaY === 0) return;
    pushCanvasHistory();
    viewport.value = {
      ...viewport.value,
      x: viewport.value.x + deltaX,
      y: viewport.value.y + deltaY
    };
  }

  function setCanvasPixelSize(width: number, height: number): void {
    const w = Number.isFinite(width) && width > 0 ? width : 1200;
    const h = Number.isFinite(height) && height > 0 ? height : 800;
    canvasPixelSize.value = { width: w, height: h };
  }

  /**
   * 将视口缩放并平移，使当前空间内全部相关块进入视窗（可撤销）。
   * 文件夹聚焦时仅框住该文件夹及其子块；否则为当前空间全部块。
   */
  function fitViewportToVisibleBlocks(options?: { padding?: number }): void {
    const sid = activeSpaceId.value;
    const fid = focusedFolderBlockId.value;
    let blockIds: Set<string> | undefined;
    if (fid) {
      const folder = blocks.value.find((b) => b.id === fid);
      if (folder && isFolderKnowledgeBlock(folder)) {
        blockIds = new Set([fid]);
        if (folderHasExplicitChildList(folder)) {
          for (const cid of folderChildBlockIdsList(folder)) {
            blockIds.add(cid);
          }
        }
      }
    }

    pushCanvasHistory();
    viewport.value = computeViewportFitToBlocks(
      blocks.value,
      { spaceId: sid, blockIds, padding: options?.padding ?? 56 },
      canvasPixelSize.value
    );
  }

  function zoomBy(delta: number, anchor?: { x: number; y: number }): void {
    const previousZoom = viewport.value.zoom;
    const nextZoom = clampZoom(previousZoom + delta);
    if (nextZoom === previousZoom) return;

    pushCanvasHistory();

    if (!anchor) {
      viewport.value = { ...viewport.value, zoom: nextZoom };
      return;
    }

    const worldX = (anchor.x - viewport.value.x) / previousZoom;
    const worldY = (anchor.y - viewport.value.y) / previousZoom;

    viewport.value = {
      x: anchor.x - worldX * nextZoom,
      y: anchor.y - worldY * nextZoom,
      zoom: nextZoom
    };
  }

  /** 应用内置排版预设；有选区时只动选区，否则整理当前空间内全部块（可撤销） */
  function applyBoardLayoutPreset(preset: BoardLayoutPresetId): void {
    const sid = activeSpaceId.value;
    const sel = selectedBlockIds.value;
    const movableIds = new Set(
      sel.length > 0 ? sel : blocks.value.filter((b) => b.spaceId === sid).map((b) => b.id)
    );
    if (movableIds.size === 0) return;

    pushCanvasHistory();
    const updates = computeBoardLayoutPositions(blocks.value, sid, preset, {
      movableIds,
      gutter: 16,
      gridSnap: 8,
      maxOverlapIterations: 100
    });
    if (updates.size === 0) return;
    blocks.value = blocks.value.map((b) => {
      const p = updates.get(b.id);
      return p ? { ...b, x: p.x, y: p.y } : b;
    });
    syncActiveSpaceBlockIds();
  }

  async function refreshStorage(): Promise<void> {
    if (!window.beelite) return;

    const [stats, jobs, sources] = await Promise.all([
      window.beelite.storageStats(),
      window.beelite.listImportJobs(),
      window.beelite.listSources()
    ]);
    importStats.value = stats;
    importJobs.value = jobs;
    importSources.value = sources;
  }

  async function refreshLlmSettings(): Promise<void> {
    if (!window.beelite?.getLlmSettings) return;
    const data = await window.beelite.getLlmSettings();
    if (data) llmSettings.value = data;
  }

  async function refreshResearchSettings(): Promise<void> {
    if (!window.beelite?.getResearchSettings) return;
    const data = await window.beelite.getResearchSettings();
    researchSettings.value = data;
  }

  async function researchSearch(params: ResearchSearchParams): Promise<ResearchSearchResult> {
    if (!window.beelite?.researchSearch) {
      return {
        ok: false,
        query: params.query ?? "",
        results: [],
        error: "Electron IPC 未连接"
      };
    }
    return window.beelite.researchSearch(params);
  }

  async function researchFetchPage(params: ResearchFetchPageParams): Promise<ResearchFetchPageResult> {
    if (!window.beelite?.researchFetchPage) {
      return {
        ok: false,
        error: "Electron IPC 未连接"
      };
    }
    return window.beelite.researchFetchPage(params);
  }

  function setModelSettingsOpen(value: boolean): void {
    modelSettingsOpen.value = value;
  }

  function setPreviewBlock(blockId: string | null): void {
    previewBlockId.value = blockId;
  }

  /** 展开文件夹时：子卡片在文件夹正上方水平排开（底边对齐、相对文件夹居中），对齐 Spatial 参考交互 */
  function layoutFolderChildrenHorizontalStrip(folderId: string): void {
    const folder = blocks.value.find((b) => b.id === folderId);
    if (!folder || !isFolderKnowledgeBlock(folder)) return;
    if (!folderHasExplicitChildList(folder)) return;
    const ids = folderChildBlockIdsList(folder);
    if (ids.length === 0) return;

    const children = ids
      .map((id) => blocks.value.find((b) => b.id === id))
      .filter((b): b is KnowledgeBlock => Boolean(b));
    if (children.length === 0) return;

    const rowGap = 14;
    const aboveGap = 22;
    const folderCx = folder.x + folder.width / 2;
    const totalW =
      children.reduce((s, c) => s + c.width, 0) + rowGap * Math.max(0, children.length - 1);
    let x = folderCx - totalW / 2;
    const bottomEdgeY = folder.y - aboveGap;

    const idToPos = new Map<string, { x: number; y: number }>();
    for (const c of children) {
      const y = bottomEdgeY - c.height;
      idToPos.set(c.id, { x, y });
      x += c.width + rowGap;
    }

    blocks.value = blocks.value.map((b) => {
      const pos = idToPos.get(b.id);
      if (!pos) return b;
      return { ...b, x: pos.x, y: pos.y };
    });
  }

  function setFolderFocus(blockId: string | null): void {
    pushCanvasHistory();
    focusedFolderBlockId.value = blockId;
    if (blockId) {
      previewBlockId.value = null;
      layoutFolderChildrenHorizontalStrip(blockId);
    }
  }

  function clearFolderFocus(): void {
    if (focusedFolderBlockId.value === null) return;
    pushCanvasHistory();
    focusedFolderBlockId.value = null;
  }

  async function loadWorkspaceFromMain(): Promise<void> {
    if (!window.beelite?.loadWorkspace) return;

    const snapshot = await window.beelite.loadWorkspace();
    if (!snapshot) return;

    if (snapshot.nodes.length > 0) {
      applyLiveSnapshot(snapshot);
    } else {
      resetDemoWorkspace();
    }
  }

  async function bootstrap(): Promise<void> {
    if (!window.beelite?.loadWorkspace) {
      resetDemoWorkspace();
      return;
    }
    await refreshStorage();
    await refreshLlmSettings();
    await refreshResearchSettings();
    await loadWorkspaceFromMain();
  }

  async function importChatGpt(): Promise<void> {
    await runImport(() => window.beelite?.importChatGpt() ?? Promise.resolve(null));
  }

  async function importBookmarks(): Promise<void> {
    await runImport(() => window.beelite?.importBookmarks() ?? Promise.resolve(null));
  }

  async function runImport(task: () => Promise<ImportRunResult | null>): Promise<void> {
    importError.value = null;
    importLoading.value = true;
    try {
      const result = await task();
      if (result) {
        lastImportResult.value = result;
        importStats.value = result.stats;
      }
      await refreshStorage();
      await loadWorkspaceFromMain();
    } catch (error) {
      importError.value = error instanceof Error ? error.message : String(error);
    } finally {
      importLoading.value = false;
    }
  }

  return {
    nodes,
    edges,
    spaces,
    blocks,
    activeSpaceId,
    activeTool,
    selectedBlockIds,
    selectionCount,
    hasMultiSelection,
    selectedBlock,
    activeSpace,
    breadcrumbTrail,
    activeModelRoutes,
    providerTemplates,
    viewport,
    graphProposal,
    importStats,
    importJobs,
    importSources,
    lastImportResult,
    importError,
    importLoading,
    useLiveWorkspace,
    llmSettings,
    researchSettings,
    modelSettingsOpen,
    previewBlockId,
    focusedFolderBlockId,
    canvasCanUndo,
    canvasCanRedo,
    undoCanvas,
    redoCanvas,
    beginCanvasHistoryGroup,
    endCanvasHistoryGroup,
    setPreviewBlock,
    setFolderFocus,
    clearFolderFocus,
    setTool,
    selectBlock,
    setSelectedBlocks,
    clearSelection,
    moveBlockBy,
    moveBlocksBy,
    removeBlocks,
    removeSelectedBlocks,
    resizeBlockEdge,
    addBlockAtCenter,
    addFolderCardAtCenter,
    groupSelectionIntoFolder,
    updateBlockBody,
    panBy,
    zoomBy,
    setCanvasPixelSize,
    fitViewportToVisibleBlocks,
    applyBoardLayoutPreset,
    refreshStorage,
    refreshLlmSettings,
    refreshResearchSettings,
    researchSearch,
    researchFetchPage,
    setModelSettingsOpen,
    loadWorkspaceFromMain,
    bootstrap,
    importChatGpt,
    importBookmarks
  };
});
