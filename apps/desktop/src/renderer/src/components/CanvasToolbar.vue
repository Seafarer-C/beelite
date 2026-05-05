<script setup lang="ts">
import {
  FolderInput,
  Hand,
  Image,
  Layers,
  MousePointer2,
  Network,
  ScrollText,
  Sparkles,
  StickyNote,
  Trash2,
  Type,
  Video,
  X
} from "lucide-vue-next";
import { computed } from "vue";
import { useWorkspaceStore, type CanvasTool } from "../stores/workspace";

const store = useWorkspaceStore();

const batchMode = computed(() => store.hasMultiSelection);

const navTools: Array<{ id: CanvasTool; label: string; icon: unknown }> = [
  { id: "hand", label: "移动画布", icon: Hand },
  { id: "select", label: "选择 / 框选", icon: MousePointer2 }
];

const addTools: Array<{ id: CanvasTool; label: string; icon: unknown }> = [
  { id: "add-task", label: "任务", icon: StickyNote },
  { id: "add-knowledge", label: "笔记", icon: Type },
  { id: "add-markdown", label: "Markdown", icon: ScrollText },
  { id: "add-research", label: "研究", icon: Sparkles },
  { id: "add-graph", label: "流程图", icon: Network },
  { id: "add-image", label: "图片", icon: Image },
  { id: "add-video", label: "视频", icon: Video },
  { id: "add-folder", label: "文件夹", icon: Layers }
];

function setTool(id: CanvasTool): void {
  store.setTool(id);
}

function clearBatchSelection(): void {
  store.clearSelection();
}
</script>

<template>
  <div
    v-if="batchMode"
    class="canvas-toolbar canvas-toolbar--batch"
    role="toolbar"
    aria-label="批量操作"
  >
    <span class="canvas-toolbar__batch-label">已选 {{ store.selectionCount }} 项</span>
    <button
      type="button"
      class="tool-button tool-button--wide"
      title="合并为文件夹卡片"
      @click="store.groupSelectionIntoFolder()"
    >
      <FolderInput :size="18" />
      <span>归入文件夹</span>
    </button>
    <button
      type="button"
      class="tool-button tool-button--danger tool-button--wide"
      title="删除所选"
      @click="store.removeSelectedBlocks()"
    >
      <Trash2 :size="18" />
      <span>删除</span>
    </button>
    <button type="button" class="tool-button tool-button--ghost" title="取消选择" @click="clearBatchSelection">
      <X :size="18" />
    </button>
  </div>

  <div v-else class="canvas-toolbar" role="toolbar" aria-label="画布工具">
    <button
      v-for="tool in navTools"
      :key="tool.id"
      class="tool-button"
      :class="{ active: store.activeTool === tool.id }"
      type="button"
      :title="tool.label"
      @click="setTool(tool.id)"
    >
      <component :is="tool.icon" :size="20" />
    </button>

    <span class="canvas-toolbar__sep" aria-hidden="true" />

    <button
      v-for="tool in addTools"
      :key="tool.id"
      class="tool-button"
      :class="{ active: store.activeTool === tool.id }"
      type="button"
      :title="tool.label"
      @click="setTool(tool.id)"
    >
      <component :is="tool.icon" :size="20" />
    </button>

    <span class="canvas-toolbar__sep" aria-hidden="true" />

    <button
      v-if="store.selectionCount > 0"
      type="button"
      class="tool-button tool-button--danger"
      title="删除选中节点（Delete）"
      @click="store.removeSelectedBlocks()"
    >
      <Trash2 :size="20" />
    </button>
  </div>
</template>
