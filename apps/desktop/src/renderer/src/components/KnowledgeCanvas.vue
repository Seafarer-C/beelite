<script setup lang="ts">
import { useElementSize } from "@vueuse/core";
import { buildGraphOverlaySegments, filterSegmentsForNodes } from "@beelite/graph-engine";
import type { KnowledgeBlock } from "@beelite/shared";
import {
  BlockSpatialIndex,
  visibleBlockIds,
  visibleBlocksInPaintOrder
} from "@beelite/whiteboard-engine";
import { computed, onUnmounted, reactive, ref } from "vue";
import CanvasGraphOverlay from "./CanvasGraphOverlay.vue";
import KnowledgeCard from "./KnowledgeCard.vue";
import { useWorkspaceStore } from "../stores/workspace";

const CARD_DRAG_THRESHOLD_PX = 6;

const store = useWorkspaceStore();
const canvasRef = ref<HTMLElement | null>(null);
const { width, height } = useElementSize(canvasRef);

/** 每次依赖变更重建 R-tree；块数很大时可改为 watch + 版本号增量更新。 */
const visibleIdSet = computed(() => {
  const w = width.value || 1200;
  const h = height.value || 800;
  const idx = new BlockSpatialIndex();
  idx.load(store.blocks);
  const ids = visibleBlockIds(idx, store.viewport, { width: w, height: h }, 240);
  return new Set(ids);
});

const visibleBlocks = computed(() =>
  visibleBlocksInPaintOrder(store.blocks, visibleIdSet.value)
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

/** 整块卡片：不在 pointerdown 时选中/打开预览，避免干扰拖拽；pointerup 再选中，未拖拽则打开预览 */
const cardGesture = reactive({
  blockId: null as string | null,
  pointerId: 0,
  startX: 0,
  startY: 0,
  lastX: 0,
  lastY: 0,
  dragging: false,
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

function canvasPoint(event: PointerEvent | WheelEvent): { x: number; y: number } {
  const rect = canvasRef.value?.getBoundingClientRect();
  return {
    x: event.clientX - (rect?.left ?? 0),
    y: event.clientY - (rect?.top ?? 0)
  };
}

function onWheel(event: WheelEvent): void {
  const delta = event.deltaY > 0 ? -0.055 : 0.055;
  store.zoomBy(delta, canvasPoint(event));
}

function onPointerDown(event: PointerEvent): void {
  if (!(event.target instanceof HTMLElement)) return;
  if (event.target.closest(".knowledge-card")) return;

  dragState.active = true;
  dragState.pointerId = event.pointerId;
  dragState.lastX = event.clientX;
  dragState.lastY = event.clientY;
  canvasRef.value?.setPointerCapture(event.pointerId);
  store.selectBlock(null);
}

function onBlockPointerDown(event: PointerEvent, block: KnowledgeBlock): void {
  if (event.button !== 0) return;
  const target = event.target as HTMLElement;
  if (target.closest("[data-no-card-drag]")) return;

  event.stopPropagation();
  cardGesture.blockId = block.id;
  cardGesture.pointerId = event.pointerId;
  cardGesture.startX = event.clientX;
  cardGesture.startY = event.clientY;
  cardGesture.lastX = event.clientX;
  cardGesture.lastY = event.clientY;
  cardGesture.dragging = false;
  const el = event.currentTarget as HTMLElement;
  cardGesture.captureEl = el;
  el.setPointerCapture(event.pointerId);
}

function onPointerMove(event: PointerEvent): void {
  if (cardGesture.blockId !== null && event.pointerId === cardGesture.pointerId) {
    const dx = event.clientX - cardGesture.startX;
    const dy = event.clientY - cardGesture.startY;
    if (!cardGesture.dragging) {
      if (dx * dx + dy * dy >= CARD_DRAG_THRESHOLD_PX * CARD_DRAG_THRESHOLD_PX) {
        cardGesture.dragging = true;
      }
    }
    if (cardGesture.dragging) {
      const mx = event.clientX - cardGesture.lastX;
      const my = event.clientY - cardGesture.lastY;
      cardGesture.lastX = event.clientX;
      cardGesture.lastY = event.clientY;
      const z = store.viewport.zoom;
      store.moveBlockBy(cardGesture.blockId, mx / z, my / z);
    }
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
  if (cardGesture.blockId !== null && event.pointerId === cardGesture.pointerId) {
    const wasDragging = cardGesture.dragging;
    const bid = cardGesture.blockId;
    try {
      cardGesture.captureEl?.releasePointerCapture(event.pointerId);
    } catch {
      /* noop */
    }
    cardGesture.blockId = null;
    cardGesture.pointerId = 0;
    cardGesture.dragging = false;
    cardGesture.captureEl = null;

    if (bid) {
      store.selectBlock(bid);
      if (!wasDragging) {
        const b = store.blocks.find((x) => x.id === bid);
        if (b && (b.type === "image" || b.type === "markdown" || b.type === "video")) {
          store.setPreviewBlock(bid);
        }
      }
    }
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
}

function blockStyle(block: KnowledgeBlock): Record<string, string> {
  return {
    width: `${block.width}px`,
    height: `${block.height}px`,
    transform: `translate3d(${block.x}px, ${block.y}px, 0) rotate(${block.rotation}deg)`,
    zIndex: String(block.zIndex)
  };
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

onUnmounted(() => {
  if (panRafId !== 0) cancelAnimationFrame(panRafId);
});
</script>

<template>
  <section
    ref="canvasRef"
    class="canvas-stage"
    @wheel.prevent="onWheel"
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

      <div class="canvas-surface" :style="surfaceStyle">
        <div
          v-for="block in visibleBlocks"
          :key="block.id"
          class="block-frame"
          :style="blockStyle(block)"
          @pointerdown.capture="onBlockPointerDown($event, block)"
        >
          <KnowledgeCard :block="block" />
        </div>
      </div>
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
