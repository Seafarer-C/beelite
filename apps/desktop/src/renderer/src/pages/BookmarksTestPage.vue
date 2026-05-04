<script setup lang="ts">
import type { BrowserBookmarkChangeLogRow, BrowserBookmarkSnapshotRow } from "@beelite/storage-engine";
import { ArrowLeft, Bookmark, Database, Loader2, RefreshCw } from "lucide-vue-next";
import { computed, onMounted, ref } from "vue";
import type { LocalBookmarksPreview, LocalChromiumBookmarkProfile } from "../types/localBookmarks";

const emit = defineEmits<{ exit: [] }>();

const busy = ref(false);
const syncMessage = ref<string | null>(null);

const snapshots = ref<BrowserBookmarkSnapshotRow[]>([]);
const changeLogs = ref<BrowserBookmarkChangeLogRow[]>([]);

const rows = ref<LocalChromiumBookmarkProfile[]>([]);
const scanError = ref<string | null>(null);
const selectedPath = ref<string | null>(null);
const preview = ref<LocalBookmarksPreview | null>(null);
const manualPath = ref("");

const electronOk = computed(() => Boolean(window.beelite));

onMounted(() => {
  void (async () => {
    await refreshStored();
    await runScan();
  })();
});

function exit(): void {
  emit("exit");
}

function formatJson(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

async function refreshStored(): Promise<void> {
  if (!window.beelite?.listBookmarkSnapshots || !window.beelite?.listBookmarkChangeLogs) return;
  busy.value = true;
  try {
    snapshots.value = await window.beelite.listBookmarkSnapshots();
    changeLogs.value = await window.beelite.listBookmarkChangeLogs(800);
  } finally {
    busy.value = false;
  }
}

async function runSyncNow(): Promise<void> {
  if (!window.beelite?.runBookmarkSync) return;
  busy.value = true;
  syncMessage.value = null;
  try {
    const r = await window.beelite.runBookmarkSync();
    syncMessage.value = r.ok ? "同步完成" : `同步失败：${r.error}`;
    await refreshStored();
  } catch (e) {
    syncMessage.value = e instanceof Error ? e.message : String(e);
  } finally {
    busy.value = false;
  }
}

async function runScan(): Promise<void> {
  if (!window.beelite?.scanLocalBrowserBookmarks) {
    scanError.value = "scanLocalBrowserBookmarks 不可用";
    return;
  }
  busy.value = true;
  scanError.value = null;
  try {
    rows.value = await window.beelite.scanLocalBrowserBookmarks();
    if (rows.value.length === 0) {
      selectedPath.value = null;
      preview.value = null;
    } else if (!selectedPath.value) {
      selectRow(rows.value[0].bookmarksFilePath);
    }
  } catch (e) {
    scanError.value = e instanceof Error ? e.message : String(e);
  } finally {
    busy.value = false;
  }
}

function selectRow(bookmarksFilePath: string): void {
  selectedPath.value = bookmarksFilePath;
  void runPreview(bookmarksFilePath);
}

async function runPreview(bookmarksFilePath: string): Promise<void> {
  if (!window.beelite?.previewLocalBookmarksFile) return;
  busy.value = true;
  try {
    preview.value = await window.beelite.previewLocalBookmarksFile(bookmarksFilePath);
  } catch (e) {
    preview.value = {
      ok: false,
      bookmarksFilePath,
      folderCount: 0,
      urlBookmarkCount: 0,
      sampleBookmarks: [],
      error: e instanceof Error ? e.message : String(e)
    };
  } finally {
    busy.value = false;
  }
}

async function previewManualPath(): Promise<void> {
  const p = manualPath.value.trim();
  if (!p) return;
  selectedPath.value = p;
  await runPreview(p);
}

function openExternal(url: string): void {
  void window.beelite?.openExternal?.(url);
}
</script>

<template>
  <div class="bm-test">
    <header class="bm-test__bar">
      <button type="button" class="bm-test__back" @click="exit">
        <ArrowLeft :size="18" />
        返回应用
      </button>
      <div class="bm-test__title">
        <Bookmark :size="20" aria-hidden="true" />
        <span>浏览器收藏夹 · 存储与变更</span>
      </div>
      <span class="bm-test__pill" :data-ok="electronOk">
        {{ electronOk ? "IPC 正常" : "非 Electron / 无 preload" }}
      </span>
    </header>

    <p class="bm-test__lead">
      启动约 2 秒后主进程会静默同步 Chromium 系 <code>Bookmarks</code>（规范化树 → 按浏览器聚合 → SQLite）。
      以下为数据库中的收藏夹快照（完整 JSON）与 jsondiffpatch 变更日志。底部保留文件系统探测便于对照原始路径。
    </p>

    <div class="bm-test__grid">
      <section class="bm-test__card bm-test__card--wide">
        <div class="bm-test__row bm-test__row--between">
          <h2><Database :size="17" aria-hidden="true" /> SQLite 快照</h2>
          <div class="bm-test__row">
            <button
              type="button"
              class="bm-test__btn bm-test__btn--primary"
              :disabled="Boolean(busy) || !electronOk"
              @click="runSyncNow"
            >
              <Loader2 v-if="busy" class="bm-test__spin" :size="16" />
              <RefreshCw v-else :size="16" />
              立即同步
            </button>
            <button
              type="button"
              class="bm-test__btn bm-test__btn--ghost"
              :disabled="Boolean(busy) || !electronOk"
              @click="refreshStored"
            >
              刷新列表
            </button>
          </div>
        </div>
        <p v-if="syncMessage" class="bm-test__hint">{{ syncMessage }}</p>
        <div v-if="snapshots.length === 0" class="bm-test__empty">尚无快照（等待后台同步或点击「立即同步」）</div>
        <div v-for="s in snapshots" v-else :key="s.id" class="bm-test__json-block">
          <div class="bm-test__json-head">
            <strong>{{ s.browserType }}</strong>
            <span class="bm-test__muted">updated {{ s.updatedAt }} · hash {{ s.contentHash.slice(0, 12) }}…</span>
          </div>
          <pre class="bm-test__json">{{ formatJson(s.collections) }}</pre>
        </div>
      </section>

      <section class="bm-test__card bm-test__card--wide">
        <h2>变更日志（完整 delta_json）</h2>
        <p class="bm-test__hint">
          <code>delta_json</code> 为 jsondiffpatch 相对上一快照的结构；首同步为 <code>null</code>，
          <code>summary</code> 为 <code>initial</code>。
        </p>
        <div v-if="changeLogs.length === 0" class="bm-test__empty">尚无日志</div>
        <div v-for="log in changeLogs" v-else :key="log.id" class="bm-test__json-block">
          <div class="bm-test__json-head">
            <strong>#{{ log.id }} {{ log.browserType }}</strong>
            <span class="bm-test__muted">{{ log.occurredAt }}</span>
          </div>
          <p class="bm-test__meta">
            previous_hash: {{ log.previousHash ?? "null" }} → new_hash: {{ log.newHash }} · summary:
            {{ log.summary ?? "null" }}
          </p>
          <pre class="bm-test__json">{{ formatJson(log.deltaJson) }}</pre>
        </div>
      </section>

      <section class="bm-test__card bm-test__card--wide">
        <div class="bm-test__row bm-test__row--between">
          <h2>文件系统探测（调试）</h2>
          <button
            type="button"
            class="bm-test__btn bm-test__btn--primary"
            :disabled="Boolean(busy) || !electronOk"
            @click="runScan"
          >
            <Loader2 v-if="busy" class="bm-test__spin" :size="16" />
            <RefreshCw v-else :size="16" />
            重新扫描
          </button>
        </div>
        <p v-if="scanError" class="bm-test__err">{{ scanError }}</p>
        <div v-else class="bm-test__table-wrap">
          <table class="bm-test__table">
            <thead>
              <tr>
                <th>浏览器</th>
                <th>配置档</th>
                <th>文件夹数</th>
                <th>URL 书签</th>
                <th>状态</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="r in rows"
                :key="r.bookmarksFilePath"
                :class="{ 'bm-test__tr--active': selectedPath === r.bookmarksFilePath }"
                @click="selectRow(r.bookmarksFilePath)"
              >
                <td>{{ r.browserLabel }}</td>
                <td>
                  <span class="bm-test__mono">{{ r.profileName }}</span>
                </td>
                <td>{{ r.error ? "—" : r.folderCount ?? "—" }}</td>
                <td>{{ r.error ? "—" : r.urlBookmarkCount ?? "—" }}</td>
                <td>
                  <span v-if="r.error" class="bm-test__warn">{{ r.error }}</span>
                  <span v-else class="bm-test__ok">可读</span>
                </td>
              </tr>
              <tr v-if="rows.length === 0 && !busy">
                <td colspan="5" class="bm-test__empty">未发现含 Bookmarks 的 Chromium 配置目录</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section class="bm-test__card">
        <h2>指定路径解析（原始文件）</h2>
        <p class="bm-test__hint">直接读取单个 <code>Bookmarks</code> 文件的统计预览（非规范化树）。</p>
        <div class="bm-test__row bm-test__row--wrap">
          <label class="bm-test__grow">
            绝对路径
            <input v-model="manualPath" type="text" spellcheck="false" autocomplete="off" />
          </label>
          <button
            type="button"
            class="bm-test__btn bm-test__btn--primary"
            :disabled="Boolean(busy) || !manualPath.trim() || !electronOk"
            @click="previewManualPath"
          >
            解析
          </button>
        </div>
      </section>

      <section v-if="preview" class="bm-test__card bm-test__card--wide">
        <h2>单文件预览</h2>
        <p v-if="!preview.ok" class="bm-test__err">{{ preview.error }}</p>
        <template v-else>
          <p class="bm-test__stats">
            {{ preview.bookmarksFilePath }} · 文件夹 {{ preview.folderCount }} · URL {{ preview.urlBookmarkCount }}
          </p>
          <ul class="bm-test__samples">
            <li v-for="(b, i) in preview.sampleBookmarks" :key="i">
              <strong>{{ b.title || "（无标题）" }}</strong>
              <a
                v-if="b.url"
                :href="b.url"
                class="bm-test__link"
                @click.prevent="openExternal(b.url)"
                >{{ b.url }}</a
              >
            </li>
          </ul>
        </template>
      </section>
    </div>
  </div>
</template>

<style scoped>
.bm-test {
  box-sizing: border-box;
  min-height: 100vh;
  padding: 20px 24px 48px;
  background: #f0efe9;
  color: #1a1b18;
  font-size: 13px;
}

.bm-test__bar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px 16px;
  margin-bottom: 12px;
}

.bm-test__back {
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

.bm-test__back:hover {
  border-color: rgba(28, 79, 214, 0.35);
  color: #1c4fd6;
}

.bm-test__title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 700;
  font-size: 16px;
}

.bm-test__pill {
  padding: 4px 10px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 650;
  background: rgba(180, 35, 24, 0.12);
  color: #8c2018;
}

.bm-test__pill[data-ok="true"] {
  background: rgba(22, 130, 85, 0.14);
  color: #126542;
}

.bm-test__lead {
  margin: 0 0 16px;
  max-width: 960px;
  color: #5c5e59;
  font-size: 12px;
  line-height: 1.5;
}

.bm-test__lead code {
  padding: 1px 6px;
  border-radius: 4px;
  background: rgba(26, 27, 24, 0.06);
  font-size: 11px;
}

.bm-test__grid {
  display: grid;
  gap: 16px;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
}

.bm-test__card {
  padding: 16px 18px;
  border-radius: 12px;
  background: #fff;
  border: 1px solid rgba(26, 27, 24, 0.08);
  box-shadow: 0 1px 2px rgba(26, 27, 24, 0.04);
}

.bm-test__card--wide {
  grid-column: 1 / -1;
}

.bm-test__card h2 {
  margin: 0 0 10px;
  font-size: 14px;
  font-weight: 700;
  display: flex;
  align-items: center;
  gap: 8px;
}

.bm-test__hint {
  margin: 0 0 12px;
  color: #5c5e59;
  font-size: 12px;
  line-height: 1.45;
}

.bm-test__row {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  gap: 10px 12px;
  margin-bottom: 12px;
}

.bm-test__row--between {
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.bm-test__row--wrap {
  align-items: flex-end;
}

.bm-test__grow {
  flex: 1 1 200px;
}

.bm-test__row label {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 11px;
  font-weight: 600;
  color: #5c5e59;
}

.bm-test__row input {
  min-width: 0;
  padding: 8px 10px;
  border: 1px solid rgba(26, 27, 24, 0.14);
  border-radius: 8px;
  font-size: 12px;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
}

.bm-test__btn {
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

.bm-test__btn:disabled {
  opacity: 0.45;
  cursor: default;
}

.bm-test__btn--primary {
  background: #1c4fd6;
  border-color: #1c4fd6;
  color: #fff;
}

.bm-test__btn--primary:hover:not(:disabled) {
  filter: brightness(1.05);
}

.bm-test__btn--ghost {
  background: transparent;
}

.bm-test__spin {
  animation: bm-test-spin 0.75s linear infinite;
}

@keyframes bm-test-spin {
  to {
    transform: rotate(360deg);
  }
}

.bm-test__json-block {
  margin-bottom: 16px;
}

.bm-test__json-block:last-child {
  margin-bottom: 0;
}

.bm-test__json-head {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 8px 12px;
  margin-bottom: 6px;
}

.bm-test__muted {
  font-size: 11px;
  color: #8b8d88;
}

.bm-test__meta {
  margin: 0 0 8px;
  font-size: 11px;
  color: #5c5e59;
  word-break: break-all;
}

.bm-test__json {
  margin: 0;
  max-height: min(56vh, 640px);
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

.bm-test__table-wrap {
  overflow: auto;
  margin-bottom: 10px;
  border-radius: 8px;
  border: 1px solid rgba(26, 27, 24, 0.08);
}

.bm-test__table {
  width: 100%;
  border-collapse: collapse;
  font-size: 12px;
}

.bm-test__table th,
.bm-test__table td {
  padding: 8px 10px;
  text-align: left;
  border-bottom: 1px solid rgba(26, 27, 24, 0.06);
}

.bm-test__table th {
  background: rgba(26, 27, 24, 0.04);
  font-weight: 650;
  color: #5c5e59;
}

.bm-test__table tbody tr {
  cursor: pointer;
}

.bm-test__table tbody tr:hover {
  background: rgba(28, 79, 214, 0.04);
}

.bm-test__tr--active {
  background: rgba(28, 79, 214, 0.08) !important;
}

.bm-test__mono {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 11px;
}

.bm-test__ok {
  color: #126542;
  font-size: 11px;
  font-weight: 600;
}

.bm-test__warn {
  color: #8c4a18;
  font-size: 11px;
}

.bm-test__err {
  margin: 0 0 8px;
  color: #8c2018;
  font-size: 12px;
}

.bm-test__empty {
  padding: 12px;
  color: #8b8d88;
  text-align: center;
}

.bm-test__stats {
  margin: 0 0 8px;
  font-weight: 600;
  font-size: 12px;
  word-break: break-all;
}

.bm-test__samples {
  margin: 0;
  padding-left: 18px;
  line-height: 1.5;
}

.bm-test__samples li {
  margin-bottom: 8px;
}

.bm-test__link {
  display: block;
  margin-top: 2px;
  color: #1c4fd6;
  font-size: 11px;
  word-break: break-all;
}
</style>
