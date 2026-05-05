<script setup lang="ts">
import {
  ChevronDown,
  Download,
  Expand,
  HelpCircle,
  Minus,
  NotebookPen,
  Plus,
  Settings,
  Sparkles,
  Trash2,
  Vault
} from "lucide-vue-next";
import { computed } from "vue";
import { useWorkspaceStore } from "../stores/workspace";

const store = useWorkspaceStore();

const zoomLabel = computed(() => `${Math.round(store.viewport.zoom * 100)}%`);

const navItems = [
  { label: "知识宇宙", icon: Vault, active: true },
  { label: "笔记", icon: NotebookPen },
];

const utilityItems = [
  { label: "设置", icon: Settings },
  { label: "模型配置", icon: Sparkles },
  { label: "导入数据", icon: Download },
  { label: "回收站", icon: Trash2 }
];
</script>

<template>
  <aside class="sidebar">
    <div class="brand-row">
      <div class="brand-mark">B</div>
      <span>BeeLite</span>
      <ChevronDown :size="16" />
    </div>

    <nav class="sidebar-nav" aria-label="主导航">
      <button
        v-for="item in navItems"
        :key="item.label"
        class="nav-item"
        :class="{ active: item.active }"
        type="button"
      >
        <component :is="item.icon" :size="18" />
        <span>{{ item.label }}</span>
      </button>
    </nav>

    <nav class="sidebar-nav utility" aria-label="工具">
      <button v-for="item in utilityItems" :key="item.label" class="nav-item" type="button">
        <component :is="item.icon" :size="18" />
        <span>{{ item.label }}</span>
      </button>
    </nav>

    <div class="sidebar-spacer" />

    <section class="zoom-widget" aria-label="缩放">
      <div class="zoom-controls">
        <button type="button" aria-label="缩小" @click="store.zoomBy(-0.06)">
          <Minus :size="15" />
        </button>
        <strong>{{ zoomLabel }}</strong>
        <button type="button" aria-label="放大" @click="store.zoomBy(0.06)">
          <Plus :size="15" />
        </button>
        <button
          type="button"
          class="zoom-fit"
          aria-label="缩放到可见范围"
          title="使当前空间全部节点进入视窗（⌘⇧1）"
          @click="store.fitViewportToVisibleBlocks()"
        >
          <Expand :size="15" />
        </button>
      </div>
      <div class="mini-map-ghost">
        <span class="mini-node one" />
        <span class="mini-node two" />
        <span class="mini-node three" />
        <span class="mini-node four" />
        <span class="mini-window" />
      </div>
    </section>

    <button class="help-button" type="button" aria-label="帮助">
      <HelpCircle :size="18" />
    </button>
  </aside>
</template>
