<script setup lang="ts">
import type {
  SqliteInspectorColumnInfo,
  SqliteInspectorPageResult,
  SqliteInspectorQueryResult,
  SqliteInspectorSqlResult,
  SqliteInspectorTableSummary
} from "@beelite/storage-engine";
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Database,
  Loader2,
  Play,
  RefreshCw,
  Search,
  Table2
} from "lucide-vue-next";
import { computed, onMounted, ref, watch } from "vue";

const emit = defineEmits<{ exit: [] }>();

type ListTablesResult =
  | { ok: true; tables: SqliteInspectorTableSummary[] }
  | { ok: false; error: string };

type TableColumnsResult =
  | { ok: true; columns: SqliteInspectorColumnInfo[] }
  | { ok: false; error: string };

type TablePageResult =
  | { ok: true; page: SqliteInspectorPageResult }
  | { ok: false; error: string };

const electronOk = computed(() => Boolean(window.beelite?.dbListTables));

const busy = ref(false);
const tables = ref<SqliteInspectorTableSummary[]>([]);
const tableFilter = ref("");
const selectedTable = ref<string | null>(null);
const schemaCols = ref<SqliteInspectorColumnInfo[]>([]);
const pageData = ref<SqliteInspectorPageResult | null>(null);
const pageError = ref<string | null>(null);
const listError = ref<string | null>(null);

const pageSize = ref(50);
const currentPage = ref(0);

const sqlDraft = ref("SELECT name, type FROM sqlite_master WHERE type = 'table' ORDER BY name;");
const sqlBusy = ref(false);
const sqlResult = ref<SqliteInspectorQueryResult | null>(null);
const sqlError = ref<string | null>(null);

const filteredTables = computed(() => {
  const q = tableFilter.value.trim().toLowerCase();
  if (!q) return tables.value;
  return tables.value.filter((t) => t.name.toLowerCase().includes(q));
});

const totalPages = computed(() => {
  if (!pageData.value) return 1;
  const n = Math.max(1, Math.ceil(pageData.value.total / pageSize.value));
  return n;
});

const pageLabel = computed(() => {
  if (!pageData.value || !selectedTable.value) return "";
  const from = pageData.value.total === 0 ? 0 : currentPage.value * pageSize.value + 1;
  const to = Math.min(
    pageData.value.total,
    currentPage.value * pageSize.value + pageData.value.rows.length
  );
  return `第 ${from}–${to} 行，共 ${pageData.value.total} 行`;
});

function exit(): void {
  emit("exit");
}

async function loadTables(): Promise<void> {
  if (!window.beelite?.dbListTables) return;
  busy.value = true;
  listError.value = null;
  try {
    const res = (await window.beelite.dbListTables()) as ListTablesResult;
    if (!res.ok) {
      listError.value = res.error;
      tables.value = [];
      return;
    }
    tables.value = res.tables;
    if (
      selectedTable.value &&
      !tables.value.some((t) => t.name === selectedTable.value)
    ) {
      selectedTable.value = null;
      pageData.value = null;
      schemaCols.value = [];
    }
  } catch (e) {
    listError.value = e instanceof Error ? e.message : String(e);
    tables.value = [];
  } finally {
    busy.value = false;
  }
}

async function loadTableDetail(): Promise<void> {
  const name = selectedTable.value;
  if (!name || !window.beelite?.dbTableColumns || !window.beelite?.dbTablePage) return;
  busy.value = true;
  pageError.value = null;
  try {
    const colRes = (await window.beelite.dbTableColumns(name)) as TableColumnsResult;
    if (!colRes.ok) {
      schemaCols.value = [];
      pageData.value = null;
      pageError.value = colRes.error;
      return;
    }
    schemaCols.value = colRes.columns;

    const off = currentPage.value * pageSize.value;
    const pageRes = (await window.beelite.dbTablePage(
      name,
      pageSize.value,
      off
    )) as TablePageResult;
    if (!pageRes.ok) {
      pageData.value = null;
      pageError.value = pageRes.error;
      return;
    }
    pageData.value = pageRes.page;
  } catch (e) {
    pageError.value = e instanceof Error ? e.message : String(e);
    pageData.value = null;
  } finally {
    busy.value = false;
  }
}

function selectTable(name: string): void {
  if (selectedTable.value === name) return;
  selectedTable.value = name;
  currentPage.value = 0;
}

async function runSql(): Promise<void> {
  if (!window.beelite?.dbRunReadOnlySql) return;
  sqlBusy.value = true;
  sqlError.value = null;
  sqlResult.value = null;
  try {
    const res = (await window.beelite.dbRunReadOnlySql(sqlDraft.value)) as SqliteInspectorSqlResult;
    if (!res.ok) {
      sqlError.value = res.error;
      return;
    }
    sqlResult.value = res.result;
  } catch (e) {
    sqlError.value = e instanceof Error ? e.message : String(e);
  } finally {
    sqlBusy.value = false;
  }
}

function formatCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") {
    const max = 240;
    return value.length > max ? `${value.slice(0, max)}…` : value;
  }
  if (typeof value === "object") {
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }
  return String(value);
}

function fullCell(value: unknown): string {
  if (value === null || value === undefined) return "NULL";
  if (typeof value === "object") {
    try {
      return JSON.stringify(value, null, 2);
    } catch {
      return String(value);
    }
  }
  return String(value);
}

function prevPage(): void {
  if (currentPage.value <= 0) return;
  currentPage.value -= 1;
}

function nextPage(): void {
  if (currentPage.value >= totalPages.value - 1) return;
  currentPage.value += 1;
}

watch([selectedTable, currentPage, pageSize], () => {
  if (!selectedTable.value) return;
  void loadTableDetail();
});

watch(pageSize, () => {
  currentPage.value = 0;
});

onMounted(() => {
  void loadTables();
});
</script>

<template>
  <div class="dbv">
    <header class="dbv__bar">
      <button type="button" class="dbv__back" @click="exit">
        <ArrowLeft :size="18" />
        返回应用
      </button>
      <div class="dbv__title">
        <Database :size="20" aria-hidden="true" />
        <span>数据库查看器</span>
      </div>
      <span class="dbv__pill" :data-ok="electronOk">
        {{ electronOk ? "IPC 正常" : "非 Electron / 无 preload" }}
      </span>
    </header>

    <p class="dbv__lead">
      浏览本地 <code>beelite.sqlite</code>：左侧选择表或视图，右侧查看分页数据与列结构；底部控制台仅允许 <code>SELECT</code> /
      <code>WITH</code> 只读查询（未写 <code>LIMIT</code> 时最多 500 行）。
    </p>

    <div class="dbv__layout">
      <aside class="dbv__sidebar">
        <div class="dbv__sidebar-head">
          <h2><Table2 :size="16" aria-hidden="true" /> 对象</h2>
          <button
            type="button"
            class="dbv__btn dbv__btn--ghost"
            :disabled="Boolean(busy) || !electronOk"
            title="刷新表列表"
            @click="loadTables"
          >
            <Loader2 v-if="busy" class="dbv__spin" :size="16" />
            <RefreshCw v-else :size="16" />
          </button>
        </div>
        <label class="dbv__search">
          <Search :size="14" aria-hidden="true" />
          <input v-model="tableFilter" type="search" placeholder="筛选表名…" spellcheck="false" />
        </label>
        <p v-if="listError" class="dbv__err">{{ listError }}</p>
        <ul v-else class="dbv__tree">
          <li v-for="t in filteredTables" :key="t.name">
            <button
              type="button"
              class="dbv__tree-item"
              :class="{ 'dbv__tree-item--active': selectedTable === t.name }"
              @click="selectTable(t.name)"
            >
              <span class="dbv__tree-name">{{ t.name }}</span>
              <span class="dbv__badge">{{ t.kind === "view" ? "视图" : "表" }}</span>
            </button>
          </li>
          <li v-if="!busy && filteredTables.length === 0" class="dbv__empty">无匹配对象</li>
        </ul>
      </aside>

      <div class="dbv__main">
        <section v-if="selectedTable" class="dbv__panel">
          <div class="dbv__toolbar">
            <h3>{{ selectedTable }}</h3>
            <div class="dbv__toolbar-actions">
              <label>
                每页
                <select v-model.number="pageSize">
                  <option :value="25">25</option>
                  <option :value="50">50</option>
                  <option :value="100">100</option>
                  <option :value="200">200</option>
                </select>
              </label>
              <span class="dbv__muted">{{ pageLabel }}</span>
              <button
                type="button"
                class="dbv__btn dbv__btn--ghost"
                :disabled="currentPage <= 0 || busy"
                @click="prevPage"
              >
                <ChevronLeft :size="18" />
              </button>
              <span class="dbv__page-indicator">{{ currentPage + 1 }} / {{ totalPages }}</span>
              <button
                type="button"
                class="dbv__btn dbv__btn--ghost"
                :disabled="currentPage >= totalPages - 1 || busy"
                @click="nextPage"
              >
                <ChevronRight :size="18" />
              </button>
              <button
                type="button"
                class="dbv__btn dbv__btn--ghost"
                :disabled="busy || !electronOk"
                @click="loadTableDetail"
              >
                <Loader2 v-if="busy" class="dbv__spin" :size="16" />
                <RefreshCw v-else :size="16" />
                刷新数据
              </button>
            </div>
          </div>
          <p v-if="pageError" class="dbv__err">{{ pageError }}</p>
          <div v-else-if="pageData" class="dbv__grid-wrap">
            <table class="dbv__grid">
              <thead>
                <tr>
                  <th v-for="col in pageData.columns" :key="col">{{ col }}</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="(row, ri) in pageData.rows" :key="ri">
                  <td v-for="col in pageData.columns" :key="col">
                    <span class="dbv__cell" :title="fullCell(row[col])">{{ formatCell(row[col]) }}</span>
                  </td>
                </tr>
                <tr v-if="pageData.rows.length === 0">
                  <td :colspan="Math.max(pageData.columns.length, 1)" class="dbv__empty">暂无行</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div class="dbv__schema">
            <h4>列结构</h4>
            <div class="dbv__schema-wrap">
              <table class="dbv__schema-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>名称</th>
                    <th>类型</th>
                    <th>非空</th>
                    <th>主键</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="c in schemaCols" :key="c.name">
                    <td>{{ c.cid }}</td>
                    <td class="dbv__mono">{{ c.name }}</td>
                    <td>{{ c.type || "—" }}</td>
                    <td>{{ c.notNull ? "是" : "" }}</td>
                    <td>{{ c.primaryKey ? "是" : "" }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </section>

        <section v-else class="dbv__placeholder">
          <Database :size="48" class="dbv__placeholder-icon" aria-hidden="true" />
          <p>在左侧选择一个表或视图以查看数据。</p>
        </section>

        <section class="dbv__sql">
          <div class="dbv__sql-head">
            <h3>SQL 控制台（只读）</h3>
            <button
              type="button"
              class="dbv__btn dbv__btn--primary"
              :disabled="sqlBusy || !electronOk"
              @click="runSql"
            >
              <Loader2 v-if="sqlBusy" class="dbv__spin" :size="16" />
              <Play v-else :size="16" />
              运行
            </button>
          </div>
          <textarea
            v-model="sqlDraft"
            class="dbv__sql-input"
            spellcheck="false"
            rows="5"
            autocomplete="off"
          />
          <p v-if="sqlError" class="dbv__err">{{ sqlError }}</p>
          <div v-if="sqlResult && sqlResult.columns.length" class="dbv__grid-wrap dbv__grid-wrap--sql">
            <table class="dbv__grid">
              <thead>
                <tr>
                  <th v-for="col in sqlResult.columns" :key="col">{{ col }}</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="(row, ri) in sqlResult.rows" :key="ri">
                  <td v-for="col in sqlResult.columns" :key="col">
                    <span class="dbv__cell" :title="fullCell(row[col])">{{ formatCell(row[col]) }}</span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <p v-else-if="sqlResult && sqlResult.rows.length === 0" class="dbv__muted">查询成功，无返回行。</p>
        </section>
      </div>
    </div>
  </div>
</template>

<style scoped>
.dbv {
  min-height: 100vh;
  box-sizing: border-box;
  padding: 20px 24px 48px;
  background: linear-gradient(165deg, #f4f3ef 0%, #ebe9e4 100%);
  color: #1a1a18;
  font-size: 14px;
}

.dbv__bar {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 12px;
}

.dbv__back {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 8px 14px;
  border-radius: 10px;
  border: 1px solid rgba(0, 0, 0, 0.08);
  background: #fff;
  cursor: pointer;
  font: inherit;
}

.dbv__title {
  display: flex;
  align-items: center;
  gap: 10px;
  font-weight: 650;
  font-size: 17px;
}

.dbv__pill {
  margin-left: auto;
  padding: 4px 10px;
  border-radius: 999px;
  font-size: 12px;
  background: rgba(0, 0, 0, 0.06);
}

.dbv__pill[data-ok="true"] {
  background: rgba(46, 125, 50, 0.15);
  color: #1b5e20;
}

.dbv__pill[data-ok="false"] {
  background: rgba(183, 28, 28, 0.12);
  color: #b71c1c;
}

.dbv__lead {
  margin: 0 0 20px;
  max-width: 920px;
  line-height: 1.55;
  color: #444;
}

.dbv__lead code {
  font-size: 12px;
  padding: 1px 6px;
  border-radius: 4px;
  background: rgba(0, 0, 0, 0.06);
}

.dbv__layout {
  display: grid;
  grid-template-columns: 280px minmax(0, 1fr);
  gap: 20px;
  align-items: start;
}

@media (max-width: 960px) {
  .dbv__layout {
    grid-template-columns: 1fr;
  }
}

.dbv__sidebar {
  background: #fff;
  border-radius: 14px;
  border: 1px solid rgba(0, 0, 0, 0.06);
  box-shadow: 0 8px 28px rgba(0, 0, 0, 0.05);
  padding: 14px;
  max-height: calc(100vh - 200px);
  display: flex;
  flex-direction: column;
  min-height: 320px;
}

.dbv__sidebar-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 10px;
}

.dbv__sidebar-head h2 {
  margin: 0;
  font-size: 14px;
  font-weight: 650;
  display: flex;
  align-items: center;
  gap: 8px;
}

.dbv__search {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  border-radius: 10px;
  border: 1px solid rgba(0, 0, 0, 0.08);
  margin-bottom: 10px;
  color: #666;
}

.dbv__search input {
  flex: 1;
  border: none;
  outline: none;
  font: inherit;
  min-width: 0;
  background: transparent;
}

.dbv__tree {
  list-style: none;
  margin: 0;
  padding: 0;
  overflow: auto;
  flex: 1;
}

.dbv__tree-item {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 8px 10px;
  border-radius: 8px;
  border: none;
  background: transparent;
  cursor: pointer;
  font: inherit;
  text-align: left;
}

.dbv__tree-item:hover {
  background: rgba(0, 0, 0, 0.04);
}

.dbv__tree-item--active {
  background: rgba(59, 91, 142, 0.12);
  color: #1e3a5f;
}

.dbv__tree-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.dbv__badge {
  flex-shrink: 0;
  font-size: 11px;
  padding: 2px 6px;
  border-radius: 6px;
  background: rgba(0, 0, 0, 0.06);
  color: #555;
}

.dbv__main {
  display: flex;
  flex-direction: column;
  gap: 16px;
  min-width: 0;
}

.dbv__panel {
  background: #fff;
  border-radius: 14px;
  border: 1px solid rgba(0, 0, 0, 0.06);
  box-shadow: 0 8px 28px rgba(0, 0, 0, 0.05);
  padding: 16px 18px;
}

.dbv__toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 12px;
}

.dbv__toolbar h3 {
  margin: 0;
  font-size: 16px;
  font-weight: 650;
}

.dbv__toolbar-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
}

.dbv__toolbar-actions label {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  color: #555;
}

.dbv__toolbar-actions select {
  font: inherit;
  padding: 4px 8px;
  border-radius: 8px;
  border: 1px solid rgba(0, 0, 0, 0.12);
}

.dbv__page-indicator {
  font-size: 13px;
  color: #555;
  min-width: 72px;
  text-align: center;
}

.dbv__muted {
  color: #666;
  font-size: 13px;
}

.dbv__grid-wrap {
  overflow: auto;
  max-height: min(420px, 52vh);
  border-radius: 10px;
  border: 1px solid rgba(0, 0, 0, 0.08);
}

.dbv__grid-wrap--sql {
  max-height: min(360px, 45vh);
  margin-top: 10px;
}

.dbv__grid {
  width: 100%;
  border-collapse: collapse;
  font-size: 12px;
}

.dbv__grid thead {
  position: sticky;
  top: 0;
  z-index: 1;
  background: #f0eeea;
}

.dbv__grid th,
.dbv__grid td {
  border-bottom: 1px solid rgba(0, 0, 0, 0.06);
  padding: 8px 10px;
  text-align: left;
  vertical-align: top;
}

.dbv__grid th {
  font-weight: 650;
  white-space: nowrap;
}

.dbv__cell {
  display: block;
  max-width: 320px;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  word-break: break-word;
}

.dbv__schema {
  margin-top: 18px;
  padding-top: 14px;
  border-top: 1px solid rgba(0, 0, 0, 0.06);
}

.dbv__schema h4 {
  margin: 0 0 10px;
  font-size: 13px;
  font-weight: 650;
  color: #444;
}

.dbv__schema-wrap {
  overflow: auto;
  border-radius: 10px;
  border: 1px solid rgba(0, 0, 0, 0.08);
}

.dbv__schema-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 12px;
}

.dbv__schema-table th,
.dbv__schema-table td {
  padding: 6px 10px;
  border-bottom: 1px solid rgba(0, 0, 0, 0.05);
}

.dbv__schema-table thead {
  background: #faf9f7;
}

.dbv__mono {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
}

.dbv__placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 48px 24px;
  background: #fff;
  border-radius: 14px;
  border: 1px dashed rgba(0, 0, 0, 0.12);
  color: #666;
}

.dbv__placeholder-icon {
  opacity: 0.35;
}

.dbv__sql {
  background: #fff;
  border-radius: 14px;
  border: 1px solid rgba(0, 0, 0, 0.06);
  box-shadow: 0 8px 28px rgba(0, 0, 0, 0.05);
  padding: 16px 18px;
}

.dbv__sql-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 10px;
}

.dbv__sql-head h3 {
  margin: 0;
  font-size: 15px;
  font-weight: 650;
}

.dbv__sql-input {
  width: 100%;
  box-sizing: border-box;
  padding: 12px 14px;
  border-radius: 10px;
  border: 1px solid rgba(0, 0, 0, 0.1);
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 12px;
  line-height: 1.45;
  resize: vertical;
  min-height: 100px;
}

.dbv__btn {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 8px 14px;
  border-radius: 10px;
  border: 1px solid rgba(0, 0, 0, 0.1);
  background: #fff;
  cursor: pointer;
  font: inherit;
  font-size: 13px;
}

.dbv__btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.dbv__btn--primary {
  background: #2e4a7d;
  color: #fff;
  border-color: #243c66;
}

.dbv__btn--ghost {
  background: transparent;
}

.dbv__spin {
  animation: dbv-spin 0.85s linear infinite;
}

@keyframes dbv-spin {
  to {
    transform: rotate(360deg);
  }
}

.dbv__err {
  margin: 8px 0;
  color: #b71c1c;
  font-size: 13px;
}

.dbv__empty {
  padding: 16px;
  text-align: center;
  color: #888;
}
</style>
