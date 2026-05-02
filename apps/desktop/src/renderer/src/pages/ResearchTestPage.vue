<script setup lang="ts">
import { ArrowLeft, FlaskConical, Loader2, Play } from "lucide-vue-next";
import { computed, onMounted, ref } from "vue";
import type { ResearchSearchProviderKind } from "@beelite/shared";
import { useWorkspaceStore } from "../stores/workspace";

const emit = defineEmits<{ exit: [] }>();

const store = useWorkspaceStore();

const logs = ref<string[]>([]);
const busy = ref<"search" | "fetch" | "settings" | null>(null);

const queryDraft = ref("playwright electron");
const countDraft = ref(5);
const fetchUrlDraft = ref("https://example.com");

/** 搜索通过后自动抓取正文的最大条数（避免一次拉过多页面） */
const SEARCH_RESULT_FETCH_CAP = 5;
/** 日志中每条正文展示的最大字符数（连通性测试用，避免单条过长撑爆列表） */
const BODY_PREVIEW_CHARS = 3000;

const providerPick = ref<ResearchSearchProviderKind>("browser");

function log(line: string): void {
  const t = new Date().toISOString().slice(11, 23);
  logs.value = [`[${t}] ${line}`, ...logs.value].slice(0, 200);
}

const electronOk = computed(() => Boolean(window.beelite?.researchSearch));

const settingsJson = computed(() =>
  store.researchSettings ? JSON.stringify(store.researchSettings, null, 2) : "（尚未加载）"
);

onMounted(() => {
  log(`页面就绪；Electron IPC: ${electronOk.value ? "可用" : "不可用"}`);
  void store.refreshResearchSettings().then(() => log("已拉取 research 设置快照"));
});

function exit(): void {
  emit("exit");
}

async function refreshSettings(): Promise<void> {
  busy.value = "settings";
  log("refreshResearchSettings …");
  try {
    await store.refreshResearchSettings();
    log(`设置: ${settingsJson.value.replace(/\s+/g, " ").slice(0, 200)}…`);
  } catch (e) {
    log(`错误: ${e instanceof Error ? e.message : String(e)}`);
  } finally {
    busy.value = null;
  }
}

async function applyProvider(): Promise<void> {
  if (!window.beelite?.setResearchSettings) {
    log("setResearchSettings 不可用");
    return;
  }
  busy.value = "settings";
  log(`切换提供商 → ${providerPick.value}`);
  try {
    await window.beelite.setResearchSettings({ provider: providerPick.value });
    await store.refreshResearchSettings();
    log("提供商已保存");
  } catch (e) {
    log(`错误: ${e instanceof Error ? e.message : String(e)}`);
  } finally {
    busy.value = null;
  }
}

async function runSearch(): Promise<void> {
  busy.value = "search";
  const q = queryDraft.value.trim();
  log(`researchSearch query="${q}" count=${countDraft.value}`);
  try {
    const started = performance.now();
    const result = await store.researchSearch({ query: q, count: countDraft.value });
    const ms = Math.round(performance.now() - started);
    log(`搜索完成 ${ms}ms ok=${result.ok} hits=${result.results?.length ?? 0}`);
    if (!result.ok) {
      log(`搜索失败: ${result.error ?? "unknown"}`);
    } else {
      const hits = result.results ?? [];
      log("── 检索到的网页（标题 / URL / 摘要）──");
      if (hits.length === 0) {
        log("（无结果）");
      } else {
        hits.forEach((r, i) => {
          log(`[${i + 1}] ${r.title}`);
          log(`    URL: ${r.url}`);
          const sn = (r.snippet ?? "").trim();
          if (sn) log(`    摘要: ${sn}`);
        });
      }

      const toFetch = hits.slice(0, SEARCH_RESULT_FETCH_CAP);
      if (toFetch.length > 0) {
        log(`── 抓取网页正文（前 ${toFetch.length} 条，每页最多展示 ${BODY_PREVIEW_CHARS} 字预览）──`);
        for (let i = 0; i < toFetch.length; i++) {
          const hit = toFetch[i];
          log(`[正文 ${i + 1}/${toFetch.length}] GET ${hit.url}`);
          try {
            const t0 = performance.now();
            const page = await store.researchFetchPage({ url: hit.url, maxChars: 24_000 });
            const dt = Math.round(performance.now() - t0);
            if (!page.ok) {
              log(`    失败 (${dt}ms): ${page.error ?? "unknown"}`);
              continue;
            }
            const text = page.text ?? "";
            const title = (page.title ?? "").trim() || "（无标题）";
            log(`    页面标题: ${title}`);
            log(
              `    统计: 正文 ${text.length} 字 · truncated=${Boolean(page.truncated)} · ${dt}ms`
            );
            const shown = text.slice(0, BODY_PREVIEW_CHARS);
            const rest = text.length - shown.length;
            log(
              `    正文:\n${shown}${rest > 0 ? `\n    …（以下省略 ${rest} 字；可调大 BODY_PREVIEW_CHARS 或看主进程调试）` : ""}`
            );
          } catch (err) {
            log(`    异常: ${err instanceof Error ? err.message : String(err)}`);
          }
        }
      }
    }

    if (result.browserDebug) {
      log("── browser 诊断（主进程终端亦有 [research-browser] 日志）──");
      for (const line of result.browserDebug.split("\n")) {
        if (line.trim().length > 0) log(line);
      }
    }
  } catch (e) {
    log(`异常: ${e instanceof Error ? e.message : String(e)}`);
  } finally {
    busy.value = null;
  }
}

async function runFetch(): Promise<void> {
  busy.value = "fetch";
  const url = fetchUrlDraft.value.trim();
  log(`researchFetchPage url="${url}"`);
  try {
    const started = performance.now();
    const result = await store.researchFetchPage({ url, maxChars: 8000 });
    const ms = Math.round(performance.now() - started);
    log(`完成 ${ms}ms ok=${result.ok} truncated=${Boolean(result.truncated)}`);
    if (!result.ok) log(`抓取失败: ${result.error ?? "unknown"}`);
    else log(`标题: ${result.title ?? "（空）"} 正文长度: ${(result.text ?? "").length}`);
  } catch (e) {
    log(`异常: ${e instanceof Error ? e.message : String(e)}`);
  } finally {
    busy.value = null;
  }
}

function clearLogs(): void {
  logs.value = [];
  log("日志已清空");
}
</script>

<template>
  <div class="research-test">
    <header class="research-test__bar">
      <button type="button" class="research-test__back" @click="exit">
        <ArrowLeft :size="18" />
        返回应用
      </button>
      <div class="research-test__title">
        <FlaskConical :size="20" aria-hidden="true" />
        <span>Research 连通性测试</span>
      </div>
      <span class="research-test__pill" :data-ok="electronOk">
        {{ electronOk ? "IPC 正常" : "非 Electron / 无 preload" }}
      </span>
    </header>

    <div class="research-test__grid">
      <section class="research-test__card">
        <h2>环境与设置</h2>
        <p class="research-test__hint">
          将提供商切到「browser」可不配 API Key；其它提供商需先在正式 Research 面板保存密钥。
        </p>
        <div class="research-test__row">
          <label>
            提供商
            <select v-model="providerPick">
              <option value="browser">browser</option>
              <option value="brave">brave</option>
              <option value="tavily">tavily</option>
              <option value="serper">serper</option>
            </select>
          </label>
          <button
            type="button"
            class="research-test__btn"
            :disabled="Boolean(busy) || !electronOk"
            @click="applyProvider"
          >
            <Loader2 v-if="busy === 'settings'" class="research-test__spin" :size="16" />
            应用提供商
          </button>
          <button
            type="button"
            class="research-test__btn research-test__btn--ghost"
            :disabled="Boolean(busy) || !electronOk"
            @click="refreshSettings"
          >
            刷新设置
          </button>
        </div>
        <pre class="research-test__pre">{{ settingsJson }}</pre>
      </section>

      <section class="research-test__card">
        <h2>搜索</h2>
        <p class="research-test__hint">
          执行后会打印全部检索结果；并自动对前 {{ SEARCH_RESULT_FETCH_CAP }} 条 URL 抓取正文（每条约
          {{ BODY_PREVIEW_CHARS }} 字预览）。
        </p>
        <div class="research-test__row research-test__row--wrap">
          <label class="research-test__grow">
            关键词
            <input v-model="queryDraft" type="search" autocomplete="off" />
          </label>
          <label>
            条数
            <input v-model.number="countDraft" type="number" min="1" max="20" />
          </label>
          <button
            type="button"
            class="research-test__btn research-test__btn--primary"
            :disabled="Boolean(busy) || !electronOk"
            @click="runSearch"
          >
            <Loader2 v-if="busy === 'search'" class="research-test__spin" :size="16" />
            <Play v-else :size="16" />
            执行 researchSearch
          </button>
        </div>
      </section>

      <section class="research-test__card">
        <h2>抓取正文</h2>
        <div class="research-test__row research-test__row--wrap">
          <label class="research-test__grow">
            URL
            <input v-model="fetchUrlDraft" type="url" autocomplete="off" />
          </label>
          <button
            type="button"
            class="research-test__btn research-test__btn--primary"
            :disabled="Boolean(busy) || !electronOk"
            @click="runFetch"
          >
            <Loader2 v-if="busy === 'fetch'" class="research-test__spin" :size="16" />
            <Play v-else :size="16" />
            执行 researchFetchPage
          </button>
        </div>
      </section>

      <section class="research-test__card research-test__card--wide">
        <div class="research-test__row research-test__row--between">
          <h2>日志</h2>
          <button type="button" class="research-test__btn research-test__btn--ghost" @click="clearLogs">
            清空
          </button>
        </div>
        <ul class="research-test__logs">
          <li v-for="(line, i) in logs" :key="i">{{ line }}</li>
          <li v-if="logs.length === 0" class="research-test__logs-empty">尚无日志</li>
        </ul>
      </section>
    </div>
  </div>
</template>

<style scoped>
.research-test {
  box-sizing: border-box;
  min-height: 100vh;
  padding: 20px 24px 48px;
  background: #f0efe9;
  color: #1a1b18;
  font-size: 13px;
}

.research-test__bar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px 16px;
  margin-bottom: 20px;
}

.research-test__back {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 8px 14px;
  border: 1px solid rgba(26, 27, 24, 0.12);
  border-radius: 8px;
  background: #fff;
  font-size: 13px;
  cursor: pointer;
}

.research-test__back:hover {
  border-color: rgba(28, 79, 214, 0.35);
  color: #1c4fd6;
}

.research-test__title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 700;
  font-size: 16px;
}

.research-test__pill {
  padding: 4px 10px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 650;
  background: rgba(180, 35, 24, 0.12);
  color: #8c2018;
}

.research-test__pill[data-ok="true"] {
  background: rgba(22, 130, 85, 0.14);
  color: #126542;
}

.research-test__grid {
  display: grid;
  gap: 16px;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
}

.research-test__card {
  padding: 16px 18px;
  border-radius: 12px;
  background: #fff;
  border: 1px solid rgba(26, 27, 24, 0.08);
  box-shadow: 0 1px 2px rgba(26, 27, 24, 0.04);
}

.research-test__card--wide {
  grid-column: 1 / -1;
}

.research-test__card h2 {
  margin: 0 0 10px;
  font-size: 14px;
  font-weight: 700;
}

.research-test__hint {
  margin: 0 0 12px;
  color: #5c5e59;
  font-size: 12px;
  line-height: 1.45;
}

.research-test__row {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  gap: 10px 12px;
  margin-bottom: 12px;
}

.research-test__row--wrap {
  align-items: flex-end;
}

.research-test__row--between {
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.research-test__grow {
  flex: 1 1 200px;
}

.research-test__row label {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 11px;
  font-weight: 600;
  color: #5c5e59;
}

.research-test__row input,
.research-test__row select {
  min-width: 0;
  padding: 8px 10px;
  border: 1px solid rgba(26, 27, 24, 0.14);
  border-radius: 8px;
  font-size: 13px;
}

.research-test__btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 14px;
  border-radius: 8px;
  border: 1px solid rgba(26, 27, 24, 0.14);
  background: #fff;
  font-size: 12px;
  font-weight: 650;
  cursor: pointer;
}

.research-test__btn:disabled {
  opacity: 0.45;
  cursor: default;
}

.research-test__btn--primary {
  background: #1c4fd6;
  border-color: #1c4fd6;
  color: #fff;
}

.research-test__btn--primary:hover:not(:disabled) {
  filter: brightness(1.05);
}

.research-test__btn--ghost {
  background: transparent;
}

.research-test__spin {
  animation: research-test-spin 0.75s linear infinite;
}

@keyframes research-test-spin {
  to {
    transform: rotate(360deg);
  }
}

.research-test__pre {
  margin: 0;
  max-height: 180px;
  overflow: auto;
  padding: 10px 12px;
  border-radius: 8px;
  background: rgba(26, 27, 24, 0.04);
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 11px;
  line-height: 1.45;
  white-space: pre-wrap;
  word-break: break-word;
}

.research-test__logs {
  margin: 0;
  padding: 10px 12px;
  max-height: min(52vh, 520px);
  overflow: auto;
  list-style: none;
  border-radius: 8px;
  background: rgba(26, 27, 24, 0.04);
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 11px;
  line-height: 1.5;
}

.research-test__logs li {
  margin-bottom: 4px;
}

.research-test__logs-empty {
  color: #8b8d88;
}
</style>
