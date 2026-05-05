<script setup lang="ts">
import { useElementSize } from "@vueuse/core";
import { buildGraphOverlaySegments, filterSegmentsForNodes } from "@beelite/graph-engine";
import type { KnowledgeBlock } from "@beelite/shared";
import {
  BlockSpatialIndex,
  visibleBlockIds,
  visibleBlocksInPaintOrder
} from "@beelite/whiteboard-engine";
import { computed, onMounted, onUnmounted, reactive, ref, watch } from "vue";
import CanvasGraphOverlay from "./CanvasGraphOverlay.vue";
import KnowledgeCard from "./KnowledgeCard.vue";
import {
  blockParentFolderId,
  blockTypeFromAddTool,
  folderChildBlockIdsList,
  folderHasExplicitChildList,
  isAddTool,
  isFolderKnowledgeBlock,
  useWorkspaceStore
} from "../stores/workspace";

const CARD_DRAG_THRESHOLD_PX = 6;
const MARQUEE_MIN_SIDE_PX = 4;
const PLACE_CLICK_TOLERANCE_PX = 10;

const store = useWorkspaceStore();
const canvasRef = ref<HTMLElement | null>(null);
const { width, height } = useElementSize(canvasRef);

watch(
  [width, height],
  ([w, h]) => {
    store.setCanvasPixelSize(w, h);
  },
  { immediate: true }
);

function expandVisibleIdsWithFolderDescendants(
  base: ReadonlySet<string>,
  allBlocks: readonly KnowledgeBlock[]
): Set<string> {
  const set = new Set(base);
  let added = true;
  while (added) {
    added = false;
    for (const b of allBlocks) {
      if (!set.has(b.id) || !isFolderKnowledgeBlock(b)) continue;
      if (!folderHasExplicitChildList(b)) continue;
      for (const cid of folderChildBlockIdsList(b)) {
        if (!set.has(cid)) {
          set.add(cid);
          added = true;
        }
      }
    }
  }
  return set;
}

const visibleIdSet = computed(() => {
  const w = width.value || 1200;
  const h = height.value || 800;
  const idx = new BlockSpatialIndex();
  idx.load(store.blocks);
  const ids = visibleBlockIds(idx, store.viewport, { width: w, height: h }, 240);
  return expandVisibleIdsWithFolderDescendants(new Set(ids), store.blocks);
});

const visibleBlocks = computed(() =>
  visibleBlocksInPaintOrder(store.blocks, visibleIdSet.value)
);

/** 区块中心落在文件夹矩形内则视为「文件夹内」，与聚焦层一起抬高 */
function blockInFolderRect(block: KnowledgeBlock, folder: KnowledgeBlock): boolean {
  if (block.id === folder.id) return true;
  const cx = block.x + block.width / 2;
  const cy = block.y + block.height / 2;
  return (
    cx >= folder.x &&
    cx <= folder.x + folder.width &&
    cy >= folder.y &&
    cy <= folder.y + folder.height
  );
}

/** 当前聚焦文件夹的「展开」范围：显式子树或（旧数据）几何落入矩形 */
function isBlockInFocusedFolderSubtree(
  block: KnowledgeBlock,
  focusFolderId: string,
  all: KnowledgeBlock[]
): boolean {
  if (block.id === focusFolderId) return true;
  const focusFolder = all.find((b) => b.id === focusFolderId);
  if (!focusFolder) return false;

  if (folderHasExplicitChildList(focusFolder)) {
    const list = folderChildBlockIdsList(focusFolder);
    if (list.length === 0) {
      return blockInFolderRect(block, focusFolder);
    }
    if (list.includes(block.id)) return true;
    for (const cid of list) {
      const child = all.find((b) => b.id === cid);
      if (child && isFolderKnowledgeBlock(child) && isBlockInFocusedFolderSubtree(block, cid, all)) {
        return true;
      }
    }
    return false;
  }

  return blockInFolderRect(block, focusFolder);
}

/**
 * 收起时隐藏归入文件夹的节点；展开时渲染「当前聚焦的文件夹本体」及其直属子块。
 * 嵌套时：聚焦二级文件夹时其 parentFolderId 仍是一级文件夹 id，必须单独放行当前聚焦块，否则二级文件夹卡片会被过滤掉。
 */
function shouldRenderFolderChild(block: KnowledgeBlock): boolean {
  const fid = store.focusedFolderBlockId;
  if (fid && block.id === fid && isFolderKnowledgeBlock(block)) {
    return true;
  }
  const pid = blockParentFolderId(block);
  if (!pid) return true;
  return fid === pid;
}

const visibleBlocksBack = computed(() => {
  const fid = store.focusedFolderBlockId;
  if (!fid) return visibleBlocks.value;
  const folder = store.blocks.find((b) => b.id === fid);
  if (!folder) return visibleBlocks.value;
  return visibleBlocks.value.filter((b) => !isBlockInFocusedFolderSubtree(b, fid, store.blocks));
});

const visibleBlocksFront = computed(() => {
  const fid = store.focusedFolderBlockId;
  if (!fid) return [];
  const folder = store.blocks.find((b) => b.id === fid);
  if (!folder) return [];
  return visibleBlocks.value.filter((b) => isBlockInFocusedFolderSubtree(b, fid, store.blocks));
});

const canvasBlocks = computed(() => visibleBlocks.value.filter(shouldRenderFolderChild));

const visibleBlocksBackRenderable = computed(() =>
  visibleBlocksBack.value.filter(shouldRenderFolderChild)
);

const visibleBlocksFrontRenderable = computed(() =>
  visibleBlocksFront.value.filter(shouldRenderFolderChild)
);

const visibleKnowledgeNodeIds = computed(() => {
  const set = new Set<string>();
  for (const b of store.blocks) {
    if (visibleIdSet.value.has(b.id) && b.nodeId) {
      set.add(b.nodeId);
    }
  }
  return set;
});

const overlaySegments = computed(() => {
  const base = buildGraphOverlaySegments(store.edges, store.blocks);
  return filterSegmentsForNodes(base, store.edges, visibleKnowledgeNodeIds.value);
});

const dragState = reactive({
  active: false,
  pointerId: 0,
  lastX: 0,
  lastY: 0
});

const cardGesture = reactive({
  blockId: null as string | null,
  pointerId: 0,
  startX: 0,
  startY: 0,
  lastX: 0,
  lastY: 0,
  dragging: false,
  shiftKey: false,
  captureEl: null as HTMLElement | null,
  /** 卡片拖拽：与 moveBlocksBy 多帧合并为一条撤销记录 */
  historyGroupOpen: false
});

let panCanvasHistoryGrouped = false;
let resizeCanvasHistoryGrouped = false;
let zoomCanvasHistoryGrouped = false;
let zoomCanvasHistoryFlushTimer: number | null = null;

/** 指针工具下按住空格 → 临时平移画布（与抓手一致） */
const spacePanHeld = ref(false);
/** 抓手在卡片上按下时：轻点视为「查看」；超过阈值则视为平移 */
let panTapPickBlockId: string | null = null;
let panGestureStartClientX = 0;
let panGestureStartClientY = 0;

const marqueeState = reactive({
  active: false,
  pointerId: 0,
  x0: 0,
  y0: 0,
  x1: 0,
  y1: 0
});

const placePending = reactive({
  active: false,
  pointerId: 0,
  cx: 0,
  cy: 0,
  startClientX: 0,
  startClientY: 0
});

const resizeState = reactive({
  active: false,
  edge: null as "n" | "s" | "e" | "w" | null,
  blockId: null as string | null,
  pointerId: 0,
  lastX: 0,
  lastY: 0,
  captureEl: null as HTMLElement | null
});

const panAccum = { dx: 0, dy: 0 };
let panRafId = 0;

function flushPan(): void {
  panRafId = 0;
  if (panAccum.dx !== 0 || panAccum.dy !== 0) {
    store.panBy(panAccum.dx, panAccum.dy);
    panAccum.dx = 0;
    panAccum.dy = 0;
  }
}

function schedulePanFlush(): void {
  if (panRafId !== 0) return;
  panRafId = requestAnimationFrame(flushPan);
}

const surfaceStyle = computed(() => ({
  transform: `translate3d(${store.viewport.x}px, ${store.viewport.y}px, 0) scale(${store.viewport.zoom})`
}));

function screenToWorld(clientX: number, clientY: number): { x: number; y: number } {
  const rect = canvasRef.value?.getBoundingClientRect();
  const lx = clientX - (rect?.left ?? 0);
  const ly = clientY - (rect?.top ?? 0);
  const z = store.viewport.zoom;
  return {
    x: (lx - store.viewport.x) / z,
    y: (ly - store.viewport.y) / z
  };
}

function canvasPoint(event: PointerEvent | WheelEvent): { x: number; y: number } {
  const rect = canvasRef.value?.getBoundingClientRect();
  return {
    x: event.clientX - (rect?.left ?? 0),
    y: event.clientY - (rect?.top ?? 0)
  };
}

function onWheel(event: WheelEvent): void {
  if (!zoomCanvasHistoryGrouped) {
    store.beginCanvasHistoryGroup();
    zoomCanvasHistoryGrouped = true;
  }
  const delta = event.deltaY > 0 ? -0.055 : 0.055;
  store.zoomBy(delta, canvasPoint(event));
  if (zoomCanvasHistoryFlushTimer !== null) {
    clearTimeout(zoomCanvasHistoryFlushTimer);
  }
  zoomCanvasHistoryFlushTimer = window.setTimeout(() => {
    zoomCanvasHistoryFlushTimer = null;
    if (zoomCanvasHistoryGrouped) {
      store.endCanvasHistoryGroup();
      zoomCanvasHistoryGrouped = false;
    }
  }, 220);
}

function normalizeMarquee(): { x: number; y: number; w: number; h: number } {
  const x = Math.min(marqueeState.x0, marqueeState.x1);
  const y = Math.min(marqueeState.y0, marqueeState.y1);
  const w = Math.abs(marqueeState.x1 - marqueeState.x0);
  const h = Math.abs(marqueeState.y1 - marqueeState.y0);
  return { x, y, w, h };
}

function blockIntersectsRect(
  b: KnowledgeBlock,
  rx: number,
  ry: number,
  rw: number,
  rh: number
): boolean {
  return b.x < rx + rw && b.x + b.width > rx && b.y < ry + rh && b.y + b.height > ry;
}

const marqueeStyle = computed(() => {
  if (!marqueeState.active) return {};
  const { x, y, w, h } = normalizeMarquee();
  return {
    left: `${x}px`,
    top: `${y}px`,
    width: `${w}px`,
    height: `${h}px`
  };
});

function hitTestMarquee(): string[] {
  const { x, y, w, h } = normalizeMarquee();
  if (w < MARQUEE_MIN_SIDE_PX && h < MARQUEE_MIN_SIDE_PX) return [];
  const ids: string[] = [];
  for (const b of store.blocks) {
    if (!shouldRenderFolderChild(b)) continue;
    if (b.spaceId === store.activeSpaceId && blockIntersectsRect(b, x, y, w, h)) {
      ids.push(b.id);
    }
  }
  return ids;
}

const canvasStageClass = computed(() => ({
  "canvas-stage--placement": isAddTool(store.activeTool),
  "canvas-stage--folder-focus": Boolean(store.focusedFolderBlockId),
  "canvas-stage--select-tool": store.activeTool === "select",
  "canvas-stage--hand-tool": store.activeTool === "hand",
  "canvas-stage--space-pan": spacePanHeld.value && store.activeTool === "select",
  "canvas-stage--panning": dragState.active && panCanvasHistoryGrouped
}));

function clearSpacePanHeld(): void {
  spacePanHeld.value = false;
}

/** 抓手轻点卡片：选中 / 文件夹展开 / 可预览类型进入预览（Markdown 可在预览里编辑） */
function applyBlockTapActions(bid: string, additive: boolean): void {
  store.selectBlock(bid, { additive });
  const b = store.blocks.find((x) => x.id === bid);
  if (!additive && b && isFolderKnowledgeBlock(b)) {
    if (store.focusedFolderBlockId === bid) {
      store.clearFolderFocus();
    } else {
      store.setFolderFocus(bid);
    }
  } else if (
    !additive &&
    store.selectedBlockIds.length === 1 &&
    b &&
    (b.type === "image" || b.type === "markdown" || b.type === "video")
  ) {
    store.setPreviewBlock(bid);
  }
}

function startCanvasPan(event: PointerEvent, pickBlockIdForHandTap: string | null): void {
  if (event.button !== 0 && event.button !== 1) return;
  store.beginCanvasHistoryGroup();
  panCanvasHistoryGrouped = true;
  panTapPickBlockId = pickBlockIdForHandTap;
  panGestureStartClientX = event.clientX;
  panGestureStartClientY = event.clientY;
  dragState.active = true;
  dragState.pointerId = event.pointerId;
  dragState.lastX = event.clientX;
  dragState.lastY = event.clientY;
  canvasRef.value?.setPointerCapture(event.pointerId);
}

function onWindowKeyDownSpacePan(event: KeyboardEvent): void {
  if (event.code !== "Space" && event.key !== " ") return;
  if (event.repeat) return;
  if (store.activeTool !== "select") return;
  if (store.previewBlockId || store.modelSettingsOpen) return;
  const t = event.target as HTMLElement | null;
  if (t?.closest("input, textarea, select, [contenteditable=true]")) return;
  if (t?.closest(".block-preview-root, [role='dialog']")) return;
  event.preventDefault();
  spacePanHeld.value = true;
}

function onWindowKeyUpSpacePan(event: KeyboardEvent): void {
  if (event.code !== "Space" && event.key !== " ") return;
  spacePanHeld.value = false;
}

function onFolderFocusMaskWheel(event: WheelEvent): void {
  onWheel(event);
}

function clearFolderFocusFromMask(event: MouseEvent): void {
  if (event.button !== 0) return;
  store.clearFolderFocus();
}

function onPointerDown(event: PointerEvent): void {
  if (!(event.target instanceof HTMLElement)) return;
  if (event.target.closest(".block-frame")) return;

  const tool = store.activeTool;

  if (tool === "hand") {
    if (event.button === 1) {
      event.preventDefault();
    }
    if (event.button === 0 || event.button === 1) {
      startCanvasPan(event, null);
    }
    return;
  }

  if (tool === "select") {
    if (event.button === 1) {
      event.preventDefault();
      startCanvasPan(event, null);
      return;
    }
    if (event.button === 0 && spacePanHeld.value) {
      event.preventDefault();
      startCanvasPan(event, null);
      return;
    }
    if (event.button !== 0) return;
    marqueeState.active = true;
    marqueeState.pointerId = event.pointerId;
    const w = screenToWorld(event.clientX, event.clientY);
    marqueeState.x0 = w.x;
    marqueeState.y0 = w.y;
    marqueeState.x1 = w.x;
    marqueeState.y1 = w.y;
    canvasRef.value?.setPointerCapture(event.pointerId);
    return;
  }

  if (isAddTool(tool)) {
    const w = screenToWorld(event.clientX, event.clientY);
    placePending.active = true;
    placePending.pointerId = event.pointerId;
    placePending.cx = w.x;
    placePending.cy = w.y;
    placePending.startClientX = event.clientX;
    placePending.startClientY = event.clientY;
    canvasRef.value?.setPointerCapture(event.pointerId);
  }
}

function onBlockPointerDown(event: PointerEvent, block: KnowledgeBlock): void {
  const target = event.target as HTMLElement;
  if (target.closest("[data-no-card-drag]")) return;
  if (target.closest(".block-resize-handle")) return;

  const tool = store.activeTool;

  if (tool === "hand") {
    if (event.button === 1) {
      event.preventDefault();
    }
    if (event.button !== 0 && event.button !== 1) return;
    if (event.button === 0) {
      event.preventDefault();
    }
    event.stopPropagation();
    startCanvasPan(event, event.button === 0 ? block.id : null);
    return;
  }

  if (tool === "select" && (spacePanHeld.value || event.button === 1)) {
    if (event.button === 1) {
      event.preventDefault();
    }
    event.stopPropagation();
    startCanvasPan(event, null);
    return;
  }

  if (event.button !== 0) return;

  event.stopPropagation();
  cardGesture.blockId = block.id;
  cardGesture.pointerId = event.pointerId;
  cardGesture.startX = event.clientX;
  cardGesture.startY = event.clientY;
  cardGesture.lastX = event.clientX;
  cardGesture.lastY = event.clientY;
  cardGesture.dragging = false;
  cardGesture.historyGroupOpen = false;
  cardGesture.shiftKey = event.shiftKey;
  const el = event.currentTarget as HTMLElement;
  cardGesture.captureEl = el;
  el.setPointerCapture(event.pointerId);
}

function onResizePointerDown(
  edge: "n" | "s" | "e" | "w",
  event: PointerEvent,
  blockId: string
): void {
  event.stopPropagation();
  event.preventDefault();
  if (event.button !== 0) return;
  store.beginCanvasHistoryGroup();
  resizeCanvasHistoryGrouped = true;
  resizeState.active = true;
  resizeState.edge = edge;
  resizeState.blockId = blockId;
  resizeState.pointerId = event.pointerId;
  resizeState.lastX = event.clientX;
  resizeState.lastY = event.clientY;
  const el = event.currentTarget as HTMLElement;
  resizeState.captureEl = el;
  el.setPointerCapture(event.pointerId);
}

function onPointerMove(event: PointerEvent): void {
  if (resizeState.active && event.pointerId === resizeState.pointerId) {
    const mx = event.clientX - resizeState.lastX;
    const my = event.clientY - resizeState.lastY;
    resizeState.lastX = event.clientX;
    resizeState.lastY = event.clientY;
    const z = store.viewport.zoom;
    if (resizeState.blockId && resizeState.edge) {
      store.resizeBlockEdge(resizeState.blockId, resizeState.edge, mx / z, my / z);
    }
    return;
  }

  if (cardGesture.blockId !== null && event.pointerId === cardGesture.pointerId) {
    const dx = event.clientX - cardGesture.startX;
    const dy = event.clientY - cardGesture.startY;
    if (!cardGesture.dragging) {
      if (dx * dx + dy * dy >= CARD_DRAG_THRESHOLD_PX * CARD_DRAG_THRESHOLD_PX) {
        if (!cardGesture.historyGroupOpen) {
          store.beginCanvasHistoryGroup();
          cardGesture.historyGroupOpen = true;
        }
        cardGesture.dragging = true;
        const id = cardGesture.blockId;
        if (id && !store.selectedBlockIds.includes(id)) {
          store.selectBlock(id, { additive: cardGesture.shiftKey });
        }
      }
    }
    if (cardGesture.dragging && cardGesture.blockId) {
      const mx = event.clientX - cardGesture.lastX;
      const my = event.clientY - cardGesture.lastY;
      cardGesture.lastX = event.clientX;
      cardGesture.lastY = event.clientY;
      const z = store.viewport.zoom;
      const ids =
        store.selectedBlockIds.includes(cardGesture.blockId) && store.selectedBlockIds.length > 1
          ? [...store.selectedBlockIds]
          : [cardGesture.blockId];
      store.moveBlocksBy(ids, mx / z, my / z);
    }
    return;
  }

  if (marqueeState.active && event.pointerId === marqueeState.pointerId) {
    const w = screenToWorld(event.clientX, event.clientY);
    marqueeState.x1 = w.x;
    marqueeState.y1 = w.y;
    return;
  }

  if (!dragState.active || event.pointerId !== dragState.pointerId) return;

  const deltaX = event.clientX - dragState.lastX;
  const deltaY = event.clientY - dragState.lastY;
  dragState.lastX = event.clientX;
  dragState.lastY = event.clientY;
  panAccum.dx += deltaX;
  panAccum.dy += deltaY;
  schedulePanFlush();
}

function endDrag(event: PointerEvent): void {
  if (resizeState.active && event.pointerId === resizeState.pointerId) {
    try {
      resizeState.captureEl?.releasePointerCapture(event.pointerId);
    } catch {
      /* noop */
    }
    resizeState.active = false;
    resizeState.edge = null;
    resizeState.blockId = null;
    resizeState.pointerId = 0;
    resizeState.captureEl = null;
    if (resizeCanvasHistoryGrouped) {
      store.endCanvasHistoryGroup();
      resizeCanvasHistoryGrouped = false;
    }
    return;
  }

  if (cardGesture.blockId !== null && event.pointerId === cardGesture.pointerId) {
    const wasDragging = cardGesture.dragging;
    const bid = cardGesture.blockId;
    const additive = cardGesture.shiftKey;
    const hadHistoryGroup = cardGesture.historyGroupOpen;
    try {
      cardGesture.captureEl?.releasePointerCapture(event.pointerId);
    } catch {
      /* noop */
    }
    cardGesture.blockId = null;
    cardGesture.pointerId = 0;
    cardGesture.dragging = false;
    cardGesture.historyGroupOpen = false;
    cardGesture.shiftKey = false;
    cardGesture.captureEl = null;
    if (hadHistoryGroup) {
      store.endCanvasHistoryGroup();
    }

    if (bid) {
      if (!wasDragging) {
        applyBlockTapActions(bid, additive);
      }
    }
    return;
  }

  if (marqueeState.active && event.pointerId === marqueeState.pointerId) {
    try {
      canvasRef.value?.releasePointerCapture(event.pointerId);
    } catch {
      /* noop */
    }
    const { w, h } = normalizeMarquee();
    const ids = hitTestMarquee();
    if (ids.length > 0) {
      store.setSelectedBlocks(ids);
    } else if (w < MARQUEE_MIN_SIDE_PX && h < MARQUEE_MIN_SIDE_PX) {
      store.clearSelection();
    }
    marqueeState.active = false;
    marqueeState.pointerId = 0;
    return;
  }

  if (placePending.active && event.pointerId === placePending.pointerId) {
    try {
      canvasRef.value?.releasePointerCapture(event.pointerId);
    } catch {
      /* noop */
    }
    const dx = event.clientX - placePending.startClientX;
    const dy = event.clientY - placePending.startClientY;
    if (dx * dx + dy * dy <= PLACE_CLICK_TOLERANCE_PX * PLACE_CLICK_TOLERANCE_PX) {
      if (store.activeTool === "add-folder") {
        store.addFolderCardAtCenter(placePending.cx, placePending.cy);
      } else {
        const bt = blockTypeFromAddTool(store.activeTool);
        if (bt) {
          store.addBlockAtCenter(bt, placePending.cx, placePending.cy);
        }
      }
      if (isAddTool(store.activeTool)) {
        store.setTool("select");
      }
    }
    placePending.active = false;
    placePending.pointerId = 0;
    return;
  }

  if (event.pointerId !== dragState.pointerId) return;

  dragState.active = false;
  canvasRef.value?.releasePointerCapture(event.pointerId);
  if (panRafId !== 0) {
    cancelAnimationFrame(panRafId);
    panRafId = 0;
  }
  flushPan();
  if (panCanvasHistoryGrouped) {
    const dx = event.clientX - panGestureStartClientX;
    const dy = event.clientY - panGestureStartClientY;
    const smallMove = dx * dx + dy * dy < CARD_DRAG_THRESHOLD_PX * CARD_DRAG_THRESHOLD_PX;
    const pickId = panTapPickBlockId;
    panTapPickBlockId = null;
    if (smallMove && pickId && store.activeTool === "hand") {
      applyBlockTapActions(pickId, false);
    }
    store.endCanvasHistoryGroup();
    panCanvasHistoryGrouped = false;
  }
}

function blockOuterStyle(block: KnowledgeBlock): Record<string, string> {
  return {
    width: `${block.width}px`,
    height: `${block.height}px`,
    transform: `translate3d(${block.x}px, ${block.y}px, 0) rotate(${block.rotation}deg)`,
    zIndex: String(block.zIndex)
  };
}

/** 直属子节点在父文件夹展开时出现：自下而上、由小变大（交错延迟） */
function isFolderChildStripReveal(block: KnowledgeBlock): boolean {
  const pid = blockParentFolderId(block);
  if (!pid) return false;
  return store.focusedFolderBlockId === pid;
}

function folderRevealStaggerStyle(block: KnowledgeBlock): Record<string, string> {
  if (!isFolderChildStripReveal(block)) return {};
  const pid = blockParentFolderId(block)!;
  const parent = store.blocks.find((b) => b.id === pid);
  if (!parent || !isFolderKnowledgeBlock(parent)) return {};
  const list = folderChildBlockIdsList(parent);
  const idx = list.indexOf(block.id);
  const i = idx >= 0 ? idx : 0;
  return { animationDelay: `${i * 42}ms` };
}

function miniStyle(block: KnowledgeBlock): Record<string, string> {
  const x = 50 + block.x / 45;
  const y = 44 + block.y / 45;
  return {
    left: `${Math.max(4, Math.min(88, x))}%`,
    top: `${Math.max(6, Math.min(86, y))}%`,
    width: `${Math.max(8, block.width / 42)}px`,
    height: `${Math.max(6, block.height / 42)}px`
  };
}

function showResizeHandles(block: KnowledgeBlock): boolean {
  if (isFolderKnowledgeBlock(block)) return false;
  if (blockParentFolderId(block)) return false;
  return (
    store.activeTool === "select" &&
    store.selectedBlockIds.length === 1 &&
    store.selectedBlockIds[0] === block.id
  );
}

function onDeleteKey(event: KeyboardEvent): void {
  if (event.key === "Escape") {
    if (store.focusedFolderBlockId) {
      store.clearFolderFocus();
      event.preventDefault();
    }
    return;
  }
  if (event.key !== "Backspace" && event.key !== "Delete") return;
  const t = event.target as HTMLElement | null;
  if (t?.closest("input, textarea, [contenteditable=true]")) return;
  if (store.selectedBlockIds.length === 0) return;
  event.preventDefault();
  store.removeSelectedBlocks();
}

onMounted(() => {
  window.addEventListener("keydown", onDeleteKey);
  window.addEventListener("keydown", onWindowKeyDownSpacePan, true);
  window.addEventListener("keyup", onWindowKeyUpSpacePan, true);
  window.addEventListener("blur", clearSpacePanHeld);
});

onUnmounted(() => {
  window.removeEventListener("keydown", onDeleteKey);
  window.removeEventListener("keydown", onWindowKeyDownSpacePan, true);
  window.removeEventListener("keyup", onWindowKeyUpSpacePan, true);
  window.removeEventListener("blur", clearSpacePanHeld);
  clearSpacePanHeld();
  if (panRafId !== 0) cancelAnimationFrame(panRafId);
  if (zoomCanvasHistoryFlushTimer !== null) {
    clearTimeout(zoomCanvasHistoryFlushTimer);
    zoomCanvasHistoryFlushTimer = null;
  }
  if (zoomCanvasHistoryGrouped) {
    store.endCanvasHistoryGroup();
    zoomCanvasHistoryGrouped = false;
  }
});
</script>

<template>
  <section
    ref="canvasRef"
    class="canvas-stage"
    :class="canvasStageClass"
    @wheel.prevent="onWheel"
    @auxclick.prevent
    @pointerdown="onPointerDown"
    @pointermove="onPointerMove"
    @pointerup="endDrag"
    @pointercancel="endDrag"
  >
    <div class="canvas-texture" />

    <div class="canvas-layer-stack">
      <CanvasGraphOverlay
        class="canvas-graph-overlay-wrap"
        :segments="overlaySegments"
        :viewport="store.viewport"
      />

      <!-- 未聚焦文件夹：单表面 -->
      <div v-if="!store.focusedFolderBlockId" class="canvas-surface" :style="surfaceStyle">
        <div
          v-for="block in canvasBlocks"
          :key="block.id"
          class="block-frame"
          :style="blockOuterStyle(block)"
          @pointerdown="onBlockPointerDown($event, block)"
        >
          <div
            class="block-frame-inner"
            :class="{ 'block-frame-inner--folder-reveal': isFolderChildStripReveal(block) }"
            :style="folderRevealStaggerStyle(block)"
          >
            <KnowledgeCard :block="block" />
          </div>
          <template v-if="showResizeHandles(block)">
            <button
              type="button"
              class="block-resize-handle block-resize-handle--n"
              aria-label="上边缘调整高度"
              data-no-card-drag
              @pointerdown.stop="onResizePointerDown('n', $event, block.id)"
            />
            <button
              type="button"
              class="block-resize-handle block-resize-handle--s"
              aria-label="下边缘调整高度"
              data-no-card-drag
              @pointerdown.stop="onResizePointerDown('s', $event, block.id)"
            />
            <button
              type="button"
              class="block-resize-handle block-resize-handle--w"
              aria-label="左边缘调整宽度"
              data-no-card-drag
              @pointerdown.stop="onResizePointerDown('w', $event, block.id)"
            />
            <button
              type="button"
              class="block-resize-handle block-resize-handle--e"
              aria-label="右边缘调整宽度"
              data-no-card-drag
              @pointerdown.stop="onResizePointerDown('e', $event, block.id)"
            />
          </template>
        </div>

        <div v-show="marqueeState.active" class="canvas-marquee" :style="marqueeStyle" />
      </div>

      <!-- 文件夹聚焦：后景 + 蒙层 + 前景（文件夹及矩形范围内的节点） -->
      <template v-else>
        <div class="canvas-surface canvas-surface--focus-back" :style="surfaceStyle">
          <div
            v-for="block in visibleBlocksBackRenderable"
            :key="'b-' + block.id"
            class="block-frame block-frame--under-folder-focus"
            :style="blockOuterStyle(block)"
            @pointerdown="onBlockPointerDown($event, block)"
          >
            <div
              class="block-frame-inner"
              :class="{ 'block-frame-inner--folder-reveal': isFolderChildStripReveal(block) }"
              :style="folderRevealStaggerStyle(block)"
            >
              <KnowledgeCard :block="block" />
            </div>
          </div>

          <div v-show="marqueeState.active" class="canvas-marquee" :style="marqueeStyle" />
        </div>

        <div
          class="canvas-folder-focus-mask"
          aria-hidden="true"
          @wheel.prevent="onFolderFocusMaskWheel"
          @pointerdown="clearFolderFocusFromMask"
        />

        <div class="canvas-surface canvas-surface--focus-front" :style="surfaceStyle">
          <div
            v-for="block in visibleBlocksFrontRenderable"
            :key="'f-' + block.id"
            class="block-frame block-frame--folder-focus-elevated"
            :style="blockOuterStyle(block)"
            @pointerdown="onBlockPointerDown($event, block)"
          >
            <div
              class="block-frame-inner"
              :class="{ 'block-frame-inner--folder-reveal': isFolderChildStripReveal(block) }"
              :style="folderRevealStaggerStyle(block)"
            >
              <KnowledgeCard :block="block" />
            </div>
            <template v-if="showResizeHandles(block)">
              <button
                type="button"
                class="block-resize-handle block-resize-handle--n"
                aria-label="上边缘调整高度"
                data-no-card-drag
                @pointerdown.stop="onResizePointerDown('n', $event, block.id)"
              />
              <button
                type="button"
                class="block-resize-handle block-resize-handle--s"
                aria-label="下边缘调整高度"
                data-no-card-drag
                @pointerdown.stop="onResizePointerDown('s', $event, block.id)"
              />
              <button
                type="button"
                class="block-resize-handle block-resize-handle--w"
                aria-label="左边缘调整宽度"
                data-no-card-drag
                @pointerdown.stop="onResizePointerDown('w', $event, block.id)"
              />
              <button
                type="button"
                class="block-resize-handle block-resize-handle--e"
                aria-label="右边缘调整宽度"
                data-no-card-drag
                @pointerdown.stop="onResizePointerDown('e', $event, block.id)"
              />
            </template>
          </div>
        </div>
      </template>
    </div>

    <div class="canvas-minimap" aria-label="画布缩略图">
      <span
        v-for="block in store.blocks"
        :key="block.id"
        class="minimap-node"
        :style="miniStyle(block)"
      />
      <span class="minimap-window" />
    </div>
  </section>
</template>
