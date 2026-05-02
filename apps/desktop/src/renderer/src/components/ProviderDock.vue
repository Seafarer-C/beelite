<script setup lang="ts">
import { BrainCircuit, CheckCircle2, Database, GitPullRequestDraft, Sparkles } from "lucide-vue-next";
import { computed } from "vue";
import { useWorkspaceStore } from "../stores/workspace";

const store = useWorkspaceStore();

const providerCount = computed(() => store.providerTemplates.length);
const proposalNodeCount = computed(() => store.graphProposal.nodes.length);
const proposalEdgeCount = computed(() => store.graphProposal.edges.length);
</script>

<template>
  <aside class="provider-dock" aria-label="AI 状态">
    <div class="dock-action active" title="AI Copilot">
      <Sparkles :size="19" />
    </div>
    <div class="dock-action" title="图谱提议">
      <GitPullRequestDraft :size="19" />
    </div>
    <div class="dock-action" title="本地数据">
      <Database :size="19" />
    </div>
  </aside>

  <section class="runtime-panel" aria-label="运行时状态">
    <header>
      <BrainCircuit :size="18" />
      <div>
        <strong>pi-mono Runtime</strong>
        <span>{{ providerCount }} providers ready</span>
      </div>
    </header>

    <div class="route-list">
      <div v-for="route in store.activeModelRoutes" :key="route.task" class="route-item">
        <span>{{ route.task }}</span>
        <strong>{{ route.providerId }} / {{ route.model }}</strong>
      </div>
    </div>

    <div class="proposal-strip">
      <CheckCircle2 :size="17" />
      <span>{{ proposalNodeCount }} nodes · {{ proposalEdgeCount }} edges · draft</span>
    </div>
  </section>
</template>
