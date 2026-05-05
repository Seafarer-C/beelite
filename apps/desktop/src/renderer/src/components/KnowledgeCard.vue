<script setup lang="ts">
import { Check, Circle, Clock, GitBranch, Sparkles, Star } from "lucide-vue-next";
import { computed } from "vue";
import type { KnowledgeBlock } from "@beelite/shared";
import { confidenceBand } from "@beelite/graph-engine";
import { useWorkspaceStore } from "../stores/workspace";

const props = defineProps<{
  block: KnowledgeBlock;
}>();

const store = useWorkspaceStore();

const title = computed(() => String(props.block.content.title ?? "Untitled"));
const summary = computed(() => String(props.block.content.summary ?? props.block.content.body ?? ""));
const tags = computed(() => {
  const value = props.block.content.tags;
  return Array.isArray(value) ? value.map(String).slice(0, 4) : [];
});
const confidence = computed(() => Number(props.block.metadata.confidence ?? 0.7));
const taskItems = computed(() => {
  const value = props.block.content.items;
  return Array.isArray(value) ? value.map(String) : [];
});
const checkedTasks = computed(() => {
  const value = props.block.content.checked;
  return Array.isArray(value) ? value.map(Boolean) : [];
});
const steps = computed(() => {
  const value = props.block.content.steps;
  return Array.isArray(value) ? value.map(String) : [];
});
const isSelected = computed(() => store.selectedBlockId === props.block.id);

const bodyText = computed(() => String(props.block.content.body ?? ""));
const highlights = computed((): string[] => {
  const h = props.block.content.highlights;
  return Array.isArray(h) ? h.map(String) : [];
});
const dateLabel = computed(() => String(props.block.metadata.dateLabel ?? ""));

const isFolder = computed(() => props.block.metadata.variant === "folder");
const isStamp = computed(() => props.block.metadata.variant === "stamp");
const isHero = computed(() => props.block.metadata.variant === "hero");
const mediaLayout = computed(() => props.block.metadata.layout === "media-header");

const imageSrc = computed(() => {
  const c = props.block.content;
  if (typeof c.imageSrc === "string" && c.imageSrc.length > 0) return c.imageSrc;
  return "";
});
const heroImage = computed(() => String(props.block.content.heroImage ?? ""));
const folderCount = computed(() => Number(props.block.metadata.folderCount ?? 0));
const videoUrl = computed(() => String(props.block.content.videoUrl ?? ""));

function bodyWithHighlights(): string {
  let t = bodyText.value;
  for (const word of highlights.value) {
    if (!word) continue;
    t = t.split(word).join(`<mark class="text-highlight">${word}</mark>`);
  }
  return t;
}
</script>

<template>
  <article
    class="knowledge-card"
    :class="[
      `type-${block.type}`,
      {
        selected: isSelected,
        'is-folder': isFolder,
        'is-stamp': isStamp,
        'is-hero': isHero,
        'is-media-header': mediaLayout && block.type === 'knowledge'
      }
    ]"
  >
    <template v-if="block.type === 'task'">
      <header class="card-header">
        <h2>{{ title }}</h2>
      </header>
      <ul class="task-list">
        <li v-for="(item, index) in taskItems" :key="item">
          <span class="task-check" :class="{ done: checkedTasks[index] }">
            <Check v-if="checkedTasks[index]" :size="12" />
          </span>
          <span>{{ item }}</span>
          <Star v-if="index === 2" :size="14" class="task-star" />
        </li>
      </ul>
    </template>

    <template v-else-if="block.type === 'image'">
      <div v-if="isStamp" class="image-stamp">
        <div class="image-stamp-fill" />
        <Clock :size="44" class="image-stamp-icon" stroke-width="1.75" />
      </div>
      <div v-else class="image-card-body">
        <img
          v-if="imageSrc"
          class="image-card-img"
          :src="imageSrc"
          alt=""
          draggable="false"
          loading="lazy"
          decoding="async"
        />
        <p v-if="block.content.caption" class="image-caption">
          {{ block.content.caption }}
        </p>
      </div>
    </template>

    <template v-else-if="block.type === 'video'">
      <div class="video-card">
        <video
          v-if="videoUrl"
          class="video-card-thumb"
          muted
          playsinline
          preload="metadata"
          :src="videoUrl"
        />
        <div v-else class="video-card-placeholder" />
        <div class="video-card-scrim">
          <span class="video-card-title">{{ title || "Video" }}</span>
          <span class="video-card-hint">点击全屏预览</span>
        </div>
      </div>
    </template>

    <template v-else-if="block.type === 'graph'">
      <header class="card-header">
        <h2>{{ title }}</h2>
        <GitBranch :size="18" />
      </header>
      <div class="flow-steps">
        <span v-for="(step, index) in steps" :key="step">
          <strong>{{ index + 1 }}</strong>
          <small>{{ step }}</small>
        </span>
      </div>
      <p class="graph-caption">antv 图表</p>
    </template>

    <template v-else-if="block.type === 'knowledge' && isFolder">
      <div class="folder-card-inner">
        <Star :size="22" class="folder-star" fill="currentColor" />
        <div class="folder-meta">
          <span class="folder-count">{{ folderCount }} items</span>
          <h2>{{ title }}</h2>
          <p>{{ summary }}</p>
        </div>
      </div>
    </template>

    <template v-else-if="block.type === 'knowledge' && mediaLayout">
      <div class="media-header-card">
        <div class="media-header-photo">
          <img :src="heroImage" alt="" draggable="false" loading="lazy" decoding="async" />
        </div>
        <div class="media-header-body">
          <h2>{{ title }}</h2>
          <p>{{ summary }}</p>
        </div>
      </div>
    </template>

    <template v-else-if="block.type === 'markdown'">
      <header class="card-header card-header--dense">
        <h2>{{ title }}</h2>
        <span v-if="dateLabel" class="card-date">{{ dateLabel }}</span>
      </header>
      <div class="markdown-body markdown-body--card-teaser">
        <div v-html="bodyWithHighlights()" />
      </div>
      <p class="markdown-card-hint">点击全屏阅读</p>
    </template>

    <template v-else>
      <header class="card-header">
        <h2>{{ title }}</h2>
        <Sparkles v-if="block.type === 'research'" :size="17" />
      </header>
      <p>{{ summary }}</p>
      <div v-if="tags.length > 0" class="tag-row">
        <span v-for="tag in tags" :key="tag">{{ tag }}</span>
      </div>
      <footer class="card-footer">
        <span>{{ block.type === "research" ? "Research" : "Knowledge" }}</span>
        <span class="confidence-pill" :class="confidenceBand(confidence)">
          <Circle :size="8" />
          {{ Math.round(confidence * 100) }}%
        </span>
      </footer>
    </template>
  </article>
</template>
