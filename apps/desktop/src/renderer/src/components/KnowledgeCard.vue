<script setup lang="ts">
import { Check, Circle, GitBranch, Sparkles, Star } from "lucide-vue-next";
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
  return Array.isArray(value) ? value.map(String).slice(0, 3) : [];
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
</script>

<template>
  <article
    class="knowledge-card"
    :class="[`type-${block.type}`, { selected: isSelected }]"
    @pointerdown.stop="store.selectBlock(block.id)"
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
          <Star v-if="index === 2" :size="14" />
        </li>
      </ul>
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

    <template v-else>
      <header class="card-header">
        <h2>{{ title }}</h2>
        <Sparkles v-if="block.type === 'research'" :size="17" />
      </header>
      <p>{{ summary }}</p>
      <div class="tag-row" v-if="tags.length > 0">
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
