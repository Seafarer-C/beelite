<script setup lang="ts">
import { computed } from "vue";
import type { ViewportState } from "@beelite/shared";
import { worldToScreen } from "@beelite/whiteboard-engine";
import type { WorldSegment } from "@beelite/graph-engine";

const props = defineProps<{
  segments: WorldSegment[];
  viewport: ViewportState;
}>();

const lines = computed(() => {
  const z = Math.max(0.35, props.viewport.zoom);
  return props.segments.map((s) => {
    const a = worldToScreen(s.from, props.viewport);
    const b = worldToScreen(s.to, props.viewport);
    return {
      id: s.id,
      x1: a.x,
      y1: a.y,
      x2: b.x,
      y2: b.y,
      strokeW: Math.min(2.4, Math.max(1, 1.15 * z)),
      capR: Math.max(2.25, 3.2 * z)
    };
  });
});
</script>

<template>
  <svg
    class="canvas-graph-overlay"
    width="100%"
    height="100%"
    aria-hidden="true"
  >
    <g
      v-for="line in lines"
      :key="line.id"
      class="graph-edge-group"
    >
      <line
        :x1="line.x1"
        :y1="line.y1"
        :x2="line.x2"
        :y2="line.y2"
        class="graph-edge-line"
        :stroke-width="line.strokeW"
      />
      <circle
        :cx="line.x1"
        :cy="line.y1"
        :r="line.capR"
        class="graph-edge-cap"
      />
      <circle
        :cx="line.x2"
        :cy="line.y2"
        :r="line.capR"
        class="graph-edge-cap"
      />
    </g>
  </svg>
</template>
