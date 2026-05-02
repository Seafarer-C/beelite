<script setup lang="ts">
import { useElementSize } from "@vueuse/core";
import { computed, reactive, ref } from "vue";
import type { KnowledgeBlock } from "@beelite/shared";
import { isBlockVisible } from "@beelite/whiteboard-engine";
import KnowledgeCard from "./KnowledgeCard.vue";
import { useWorkspaceStore } from "../stores/workspace";

const store = useWorkspaceStore();
const canvasRef = ref<HTMLElement | null>(null);
const { width, height } = useElementSize(canvasRef);

const dragState = reactive({
  active: false,
  pointerId: 0,
  lastX: 0,
  lastY: 0
});

const visibleBlocks = computed(() =>
  store.blocks.filter((block) =>
    isBlockVisible(block, store.viewport, {
      width: width.value || 1200,
      height: height.value || 800
    })
  )
);

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

function onPointerMove(event: PointerEvent): void {
  if (!dragState.active || event.pointerId !== dragState.pointerId) return;

  const deltaX = event.clientX - dragState.lastX;
  const deltaY = event.clientY - dragState.lastY;
  dragState.lastX = event.clientX;
  dragState.lastY = event.clientY;
  store.panBy(deltaX, deltaY);
}

function endDrag(event: PointerEvent): void {
  if (event.pointerId !== dragState.pointerId) return;

  dragState.active = false;
  canvasRef.value?.releasePointerCapture(event.pointerId);
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
  const x = 50 + block.x / 20;
  const y = 42 + block.y / 20;
  return {
    left: `${Math.max(6, Math.min(86, x))}%`,
    top: `${Math.max(8, Math.min(82, y))}%`,
    width: `${Math.max(10, block.width / 18)}px`,
    height: `${Math.max(8, block.height / 18)}px`
  };
}
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

    <div class="canvas-surface" :style="surfaceStyle">
      <div
        v-for="block in visibleBlocks"
        :key="block.id"
        class="block-frame"
        :style="blockStyle(block)"
      >
        <KnowledgeCard :block="block" />
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
