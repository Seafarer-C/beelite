<script setup lang="ts">
import { FileText, Globe, Loader2, Save, Search, Trash2 } from "lucide-vue-next";
import { computed, onMounted, reactive, ref, watch } from "vue";
import type { ResearchHit, ResearchSearchProviderKind } from "@beelite/shared";
import { useWorkspaceStore } from "../stores/workspace";

const PROVIDERS: { id: ResearchSearchProviderKind; label: string; hint: string }[] = [
  {
    id: "browser",
    label: "浏览器 (Playwright / CDP)",
    hint: "无 API Key 时走无头浏览器；先 DuckDuckGo Lite，若人机墙则尝试 Bing。二者均可能被拦截，稳定搜索请用下方 API 提供商。"
  },
  {
    id: "brave",
    label: "Brave Search",
    hint: "https://brave.com/search/api/"
  },
  {
    id: "tavily",
    label: "Tavily",
    hint: "https://tavily.com/"
  },
  {
    id: "serper",
    label: "Serper (Google)",
    hint: "https://serper.dev/"
  }
];

const store = useWorkspaceStore();

const providerDraft = ref<ResearchSearchProviderKind>("brave");
const apiKeyDraft = ref("");
const queryDraft = ref("");
const searching = ref(false);
const saving = ref(false);
const hits = ref<ResearchHit[]>([]);
const panelError = ref<string | null>(null);
const searchNote = ref<string | null>(null);

const electronOk = computed(() => Boolean(window.beelite));

const providerMeta = computed(() => PROVIDERS.find((p) => p.id === providerDraft.value));

const credentialHint = computed(() => {
  const s = store.researchSettings;
  if (!s) return "";
  if (s.provider === "browser") return "本地 Chromium（无需搜索 API Key）";
  return s.hasApiKey ? "已配置搜索密钥" : "未配置 API Key";
});

const searchBlocked = computed(() => {
  const s = store.researchSettings;
  if (!s) return true;
  if (!s.needsSearchApiKey) return false;
  return !s.hasApiKey;
});

type FetchState = { loading?: boolean; title?: string; text?: string; error?: string; truncated?: boolean };
const fetchStates = reactive<Record<string, FetchState>>({});

function syncDraftFromStore(): void {
  const s = store.researchSettings;
  if (s) providerDraft.value = s.provider;
}

watch(
  () => store.researchSettings?.provider,
  () => syncDraftFromStore()
);

watch(providerDraft, async (next) => {
  if (!window.beelite?.setResearchSettings) return;
  if (!store.researchSettings || next === store.researchSettings.provider) return;
  await window.beelite.setResearchSettings({ provider: next });
  await store.refreshResearchSettings();
});

onMounted(() => {
  syncDraftFromStore();
});

async function saveCredentials(): Promise<void> {
  if (!window.beelite?.setResearchSettings) return;
  saving.value = true;
  panelError.value = null;
  searchNote.value = null;
  try {
    await window.beelite.setResearchSettings({
      provider: providerDraft.value,
      ...(apiKeyDraft.value.trim().length > 0 ? { apiKey: apiKeyDraft.value.trim() } : {})
    });
    apiKeyDraft.value = "";
    await store.refreshResearchSettings();
    searchNote.value = "已保存搜索配置";
  } catch (error) {
    panelError.value = error instanceof Error ? error.message : String(error);
  } finally {
    saving.value = false;
  }
}

async function clearCredentials(): Promise<void> {
  if (!window.beelite?.setResearchSettings) return;
  saving.value = true;
  panelError.value = null;
  searchNote.value = null;
  try {
    await window.beelite.setResearchSettings({ apiKey: null });
    apiKeyDraft.value = "";
    await store.refreshResearchSettings();
    searchNote.value = "已清除搜索 API Key";
  } catch (error) {
    panelError.value = error instanceof Error ? error.message : String(error);
  } finally {
    saving.value = false;
  }
}

async function runSearch(): Promise<void> {
  panelError.value = null;
  searchNote.value = null;
  hits.value = [];
  searching.value = true;
  try {
    const result = await store.researchSearch({ query: queryDraft.value, count: 12 });
    if (!result.ok) {
      panelError.value = result.error ?? "搜索失败";
      return;
    }
    hits.value = result.results;
    if (result.results.length === 0) {
      if (result.provider === "browser" && result.browserDebug) {
        const head = result.browserDebug.split("\n").slice(0, 6).join(" · ");
        searchNote.value = `未返回结果。${head.slice(0, 420)}…（完整多行见主进程终端 [research-browser]）`;
      } else {
        searchNote.value = "未返回结果，可尝试更换关键词或提供商";
      }
    }
  } finally {
    searching.value = false;
  }
}

async function openHit(url: string): Promise<void> {
  await window.beelite?.openExternal(url);
}

async function fetchHitBody(url: string): Promise<void> {
  fetchStates[url] = { loading: true };
  try {
    const r = await store.researchFetchPage({ url });
    if (!r.ok) {
      fetchStates[url] = { error: r.error ?? "抓取失败" };
      return;
    }
    fetchStates[url] = {
      title: r.title,
      text: r.text ?? "",
      truncated: r.truncated
    };
  } catch (error) {
    fetchStates[url] = {
      error: error instanceof Error ? error.message : String(error)
    };
  }
}
</script>

<template>
  <section class="research-panel" aria-label="联网搜索">
    <header>
      <Globe :size="17" />
      <div>
        <strong>Research · 联网搜索</strong>
        <span v-if="electronOk">{{ credentialHint }}</span>
        <span v-else>Electron IPC 未连接</span>
      </div>
    </header>

    <div class="research-config">
      <label class="research-field">
        <span>搜索后端</span>
        <select v-model="providerDraft" :disabled="!electronOk || saving">
          <option v-for="p in PROVIDERS" :key="p.id" :value="p.id">{{ p.label }}</option>
        </select>
      </label>
      <p v-if="providerMeta" class="research-provider-hint">
        <template v-if="providerDraft === 'browser'">{{ providerMeta.hint }}</template>
        <template v-else>
          获取密钥：
          <a href="#" @click.prevent="openHit(providerMeta.hint)">{{ providerMeta.hint }}</a>
        </template>
      </p>

      <template v-if="providerDraft !== 'browser'">
        <label class="research-field">
          <span>API Key</span>
          <input
            v-model="apiKeyDraft"
            type="password"
            autocomplete="off"
            :disabled="!electronOk || saving"
            :placeholder="store.researchSettings?.hasApiKey ? '留空保留已有密钥' : '粘贴密钥'"
          />
        </label>

        <div class="research-config-actions">
          <button type="button" class="research-btn" :disabled="!electronOk || saving" @click="saveCredentials">
            <Save :size="15" />
            保存
          </button>
          <button
            type="button"
            class="research-btn danger"
            :disabled="!electronOk || saving || !store.researchSettings?.hasApiKey"
            @click="clearCredentials"
          >
            <Trash2 :size="15" />
            清除密钥
          </button>
        </div>
      </template>
    </div>

    <div class="research-search-row">
      <input
        v-model="queryDraft"
        class="research-query"
        type="search"
        placeholder="输入问题或关键词…"
        :disabled="!electronOk || searching || searchBlocked"
        @keydown.enter.prevent="runSearch"
      />
      <button
        type="button"
        class="research-search-btn"
        :disabled="!electronOk || searching || searchBlocked"
        @click="runSearch"
      >
        <Loader2 v-if="searching" class="research-spin" :size="17" />
        <Search v-else :size="17" />
      </button>
    </div>

    <p v-if="panelError" class="research-error">{{ panelError }}</p>
    <p v-else-if="searchNote" class="research-note">{{ searchNote }}</p>

    <ul v-if="hits.length > 0" class="research-hits">
      <li v-for="(hit, index) in hits" :key="`${hit.url}-${index}`" class="research-hit">
        <button type="button" class="research-hit-link" @click="openHit(hit.url)">
          {{ hit.title }}
        </button>
        <span class="research-hit-url">{{ hit.url }}</span>
        <p class="research-hit-snippet">{{ hit.snippet }}</p>
        <div class="research-hit-actions">
          <button
            type="button"
            class="research-fetch-btn"
            :disabled="!electronOk || fetchStates[hit.url]?.loading"
            @click="fetchHitBody(hit.url)"
          >
            <Loader2 v-if="fetchStates[hit.url]?.loading" class="research-spin" :size="14" />
            <FileText v-else :size="14" />
            抓取正文 (CDP)
          </button>
        </div>
        <p v-if="fetchStates[hit.url]?.error" class="research-fetch-error">{{ fetchStates[hit.url]?.error }}</p>
        <template v-else-if="fetchStates[hit.url]?.text !== undefined">
          <p v-if="fetchStates[hit.url]?.title" class="research-fetch-title">{{ fetchStates[hit.url]?.title }}</p>
          <p v-if="fetchStates[hit.url]?.truncated" class="research-fetch-note">正文已截断（达上限）</p>
          <pre class="research-fetch-body">{{ fetchStates[hit.url]?.text }}</pre>
        </template>
      </li>
    </ul>
  </section>
</template>
