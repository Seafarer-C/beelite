<script setup lang="ts">
import {
  BrainCircuit,
  CheckCircle2,
  Database,
  GitPullRequestDraft,
  Settings2,
  Sparkles
} from "lucide-vue-next";
import { computed } from "vue";
import type { LlmProviderCredentialState } from "@beelite/shared";
import ModelSettingsModal from "./ModelSettingsModal.vue";
import { useWorkspaceStore } from "../stores/workspace";

const store = useWorkspaceStore();

const providerCount = computed(() => store.providerTemplates.length);
const configuredCount = computed(
  () => store.llmSettings?.providers.filter((p: LlmProviderCredentialState) => p.hasApiKey).length ?? 0
);
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
    <header class="runtime-panel-header">
      <div class="runtime-panel-heading">
        <BrainCircuit :size="18" />
        <div>
          <strong>模型路由</strong>
          <span>{{ configuredCount }} / {{ providerCount }} 提供商已配置密钥</span>
        </div>
      </div>
      <button
        type="button"
        class="runtime-panel-settings"
        aria-label="模型与 API 配置"
        title="模型与 API 配置"
        @click="store.setModelSettingsOpen(true)"
      >
        <Settings2 :size="17" />
      </button>
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

  <ModelSettingsModal
    :open="store.modelSettingsOpen"
    @update:open="store.setModelSettingsOpen"
  />
</template>
