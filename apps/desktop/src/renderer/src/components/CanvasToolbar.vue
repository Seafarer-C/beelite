<script setup lang="ts">
import {
  CircleDot,
  Columns2,
  FolderInput,
  GripHorizontal,
  GripVertical,
  Hand,
  Image,
  Layers,
  LayoutGrid,
  MousePointer2,
  Network,
  Orbit,
  PanelsTopLeft,
  ScanSearch,
  ScrollText,
  Sparkles,
  StickyNote,
  Trash2,
  Type,
  Video,
  Waypoints,
  X
} from "lucide-vue-next";
import { computed } from "vue";
import {
  useWorkspaceStore,
  type BoardLayoutPresetId,
  type CanvasTool
} from "../stores/workspace";

const store = useWorkspaceStore();

const batchMode = computed(() => store.hasMultiSelection);

const navTools: Array<{ id: CanvasTool; label: string; title: string; icon: unknown }> = [
  {
    id: "hand",
    label: "移动画布",
    title: "仅平移画布；点击卡片查看预览（Markdown 可在预览中编辑）",
    icon: Hand
  },
  {
    id: "select",
    label: "选择 / 框选",
    title: "拖拽框选；按住空格或中键拖拽可平移画布",
    icon: MousePointer2
  }
];

const layoutPresets: Array<{ id: BoardLayoutPresetId; label: string; title: string; icon: unknown }> = [
  {
    id: "resolve-overlaps",
    label: "去重叠",
    title: "推开重叠块，保留大致位置",
    icon: ScanSearch
  },
  { id: "grid", label: "网格", title: "近似方阵网格", icon: LayoutGrid },
  {
    id: "horizontal-row",
    label: "横排",
    title: "单行水平排列，垂直居中",
    icon: GripHorizontal
  },
  {
    id: "vertical-column",
    label: "纵列",
    title: "单列垂直排列，水平居中",
    icon: GripVertical
  },
  { id: "circle", label: "环形", title: "围绕选区中心环形摆放", icon: CircleDot },
  { id: "snake-grid", label: "蛇形", title: "网格且奇偶行反向（蛇形）", icon: Waypoints },
  {
    id: "two-columns",
    label: "双列",
    title: "阅读序拆成左右两列，垂直堆叠",
    icon: Columns2
  },
  {
    id: "brick-rows",
    label: "砖行",
    title: "错行网格，奇偶行水平错开半格",
    icon: PanelsTopLeft
  },
  {
    id: "phyllo-spiral",
    label: "叶序",
    title: "黄金角螺旋展开，适合较多节点",
    icon: Orbit
  }
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

function applyLayout(id: BoardLayoutPresetId, event: MouseEvent): void {
  store.applyBoardLayoutPreset(id);
  const det = (event.currentTarget as HTMLElement | null)?.closest("details");
  if (det) (det as HTMLDetailsElement).open = false;
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
    <details class="canvas-toolbar__layout">
      <summary class="tool-button tool-button--wide" title="排版预设（可撤销）">排版</summary>
      <div class="canvas-toolbar__layout-panel" role="menu">
        <button
          v-for="p in layoutPresets"
          :key="p.id"
          type="button"
          class="canvas-toolbar__layout-item"
          role="menuitem"
          :title="p.title"
          @click="applyLayout(p.id, $event)"
        >
          <component :is="p.icon" :size="16" />
          <span>{{ p.label }}</span>
        </button>
      </div>
    </details>
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
      :title="tool.title"
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

    <details class="canvas-toolbar__layout">
      <summary class="tool-button" title="排版预设（有选区则只整理选区，否则当前空间全部；可撤销）">
        排版
      </summary>
      <div class="canvas-toolbar__layout-panel" role="menu">
        <button
          v-for="p in layoutPresets"
          :key="p.id"
          type="button"
          class="canvas-toolbar__layout-item"
          role="menuitem"
          :title="p.title"
          @click="applyLayout(p.id, $event)"
        >
          <component :is="p.icon" :size="16" />
          <span>{{ p.label }}</span>
        </button>
      </div>
    </details>

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
