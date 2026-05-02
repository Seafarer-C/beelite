<script setup lang="ts">
import { Bookmark, Database, FileJson, Upload } from "lucide-vue-next";
import { computed } from "vue";
import { useWorkspaceStore } from "../stores/workspace";

const store = useWorkspaceStore();

const isElectronReady = computed(() => Boolean(window.beelite));
const stats = computed(
  () =>
    store.importStats ?? {
      sources: 0,
      nodes: 0,
      edges: 0,
      spaces: 0,
      blocks: 0,
      proposals: 0,
      importJobs: 0
    }
);
</script>

<template>
  <section class="import-panel" aria-label="导入数据">
    <header>
      <Database :size="17" />
      <div>
        <strong>Local Knowledge Store</strong>
        <span v-if="isElectronReady">{{ stats.sources }} sources · {{ stats.nodes }} nodes</span>
        <span v-else>Electron IPC 未连接</span>
      </div>
    </header>

    <div class="import-actions">
      <button type="button" :disabled="store.importLoading || !isElectronReady" @click="store.importChatGpt">
        <FileJson :size="16" />
        ChatGPT JSON
      </button>
      <button type="button" :disabled="store.importLoading || !isElectronReady" @click="store.importBookmarks">
        <Bookmark :size="16" />
        浏览器收藏夹
      </button>
    </div>

    <p v-if="store.importError" class="import-error">{{ store.importError }}</p>

    <div v-if="store.lastImportResult" class="import-result">
      <Upload :size="15" />
      <span>
        {{ store.lastImportResult.job.sourceCount }} sources /
        {{ store.lastImportResult.job.nodeCount }} nodes imported
      </span>
    </div>
  </section>
</template>
