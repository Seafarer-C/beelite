<script setup lang="ts">
import {
  Hand,
  Image,
  MessageSquare,
  MousePointer2,
  Network,
  PencilLine,
  StickyNote,
  Type
} from "lucide-vue-next";
import { useWorkspaceStore, type CanvasTool } from "../stores/workspace";

const store = useWorkspaceStore();

const tools: Array<{ id: CanvasTool; label: string; icon: unknown }> = [
  { id: "hand", label: "移动", icon: Hand },
  { id: "select", label: "选择", icon: MousePointer2 },
  { id: "note", label: "便签", icon: StickyNote },
  { id: "text", label: "文本", icon: Type },
  { id: "comment", label: "批注", icon: MessageSquare },
  { id: "draw", label: "画笔", icon: PencilLine },
  { id: "image", label: "图片", icon: Image },
  { id: "graph", label: "图谱", icon: Network }
];
</script>

<template>
  <div class="canvas-toolbar" role="toolbar" aria-label="画布工具">
    <button
      v-for="tool in tools"
      :key="tool.id"
      class="tool-button"
      :class="{ active: store.activeTool === tool.id }"
      type="button"
      :title="tool.label"
      @click="store.setTool(tool.id)"
    >
      <component :is="tool.icon" :size="20" />
    </button>
  </div>
</template>
