# `@beelite/research-engine` API 说明

本包提供 **联网搜索**（第三方 HTTP API、Node `fetch` + **cheerio** 静态解析、**Playwright** 兜底）及 **页面正文**（CDP 纯文本 / **cheerio + turndown** Markdown）。类型 `ResearchHit`、`ResearchSearchProviderKind` 等由 **`@beelite/shared`** 定义。

---

## 模块入口

```ts
import {
  runWebSearch,
  runBrowserSearch,
  fetchPageTextViaCdp,
  fetchPageMarkdownStatic,
  fetchPageMarkdownViaPlaywright,
  fetchPageMarkdownAuto,
  closeResearchBrowser,
  excerptAroundKeywords,
  pickRandomUserAgent,
  type BrowserSearchOutcome,
  type FetchMarkdownResult
} from "@beelite/research-engine";
```

---

## 架构概览（浏览器模式）

1. **静态 SERP（无 Playwright）**：`fetch` + 随机 **User-Agent 池** → **Bing（中/英）** → **Google** → **DuckDuckGo HTML**（多端点），用 **cheerio** 解析 `li.b_algo`、`#rso` 等；失败再进入浏览器链。
2. **Playwright**：真实 Chromium 打开 Bing / DDG，**`page.content()`** 后同样走 **cheerio / 正则（DDG HTML）** 解析，避免在页面内维护大量 `evaluate` DOM 逻辑。
3. **正文**：可选 **静态** `fetch` + cheerio 去噪 + **turndown**；短正文再 **Playwright** 加载动态页后同一套 HTML→Markdown。

---

## `runWebSearch`

通过官方 **Search HTTP API** 执行搜索；**不支持** `provider === "browser"`。

（签名、参数、行为与此前一致。）

---

## `runBrowserSearch`

### 行为摘要

- **阶段 0**：`runStaticSearchPipeline` — Node 侧 `fetch`，依次尝试 Bing zh → Bing en → Google → 多路 DDG HTML（与 `crawler/static-search.ts` 一致）。
- **阶段 1+**：共享 Playwright：Bing 中/英 → DDG HTML（多 URL）→ DDG Lite；SERP 均用 **cheerio**（或 DDG HTML 的正则）从完整 HTML 解析。
- **诊断**：`browserDebug` 多段文本，说明各阶段 HTTP 状态与命中数。

### 签名

```ts
function runBrowserSearch(query: string, count: number): Promise<BrowserSearchOutcome>;
```

### 返回值：`BrowserSearchOutcome`

与此前相同：`hits`、`debugText`、可选 `blockedReason`。

---

## `fetchPageTextViaCdp`

Playwright 打开页面后，经 CDP 抽取 **纯文本**（剔除 `script/style/...` 后 `innerText`）。适合与旧逻辑兼容、不要求 Markdown 的场景。

---

## Markdown 正文（LLM）

### `fetchPageMarkdownStatic`

仅用 **HTTP + cheerio + turndown**，不启动浏览器；适合静态 HTML。

```ts
function fetchPageMarkdownStatic(
  targetUrl: string,
  options?: { maxChars?: number; excerptKeywords?: string[] }
): Promise<{ title: string; markdown: string; truncated: boolean; ok: boolean }>;
```

### `fetchPageMarkdownViaPlaywright`

Playwright 导航后取 `page.content()`，再 cheerio 去噪 + turndown；UA 使用随机池。

```ts
function fetchPageMarkdownViaPlaywright(
  targetUrl: string,
  options?: { maxChars?: number; excerptKeywords?: string[] }
): Promise<{ title: string; markdown: string; truncated: boolean }>;
```

### `fetchPageMarkdownAuto`

先 **静态**，正文过短（默认 &lt; 400 字符）再 **Playwright**。

```ts
function fetchPageMarkdownAuto(
  targetUrl: string,
  options?: { maxChars?: number; excerptKeywords?: string[]; minStaticChars?: number }
): Promise<FetchMarkdownResult>;
```

`FetchMarkdownResult` 含 `source: "static" | "playwright"` 与 `staticEmpty`。

### `excerptAroundKeywords`

在长 Markdown 中围绕关键词截取片段，控制 token（见实现 `crawler/excerpt.ts`）。

---

## `closeResearchBrowser`

关闭共享 Chromium（`browser-pool`）。在应用退出前调用。

---

## 与 `@beelite/shared` 的关系

| 本包 API | shared 类型 |
|----------|----------------|
| `runWebSearch` / `runBrowserSearch` | `ResearchSearchProviderKind`、`ResearchHit` |

---

## 运行环境

- **Node**（Electron 主进程等）；**Playwright Chromium** 需已安装（如 `pnpm exec playwright install chromium`）。
- 主进程打包时 **`playwright` / `playwright-core`** 保持 **external**（见 `apps/desktop/electron.vite.config.ts`）；`cheerio` / `turndown` 随 workspace 包打入 bundle。

---

## 进阶（Electron 主进程）

若需 **离屏 `BrowserWindow` + `webContents.executeJavaScript`** 绕过部分检测，可在 **desktop main** 中单独实现，通过 IPC 将 HTML 或正文交给本包的 **cheerio / turndown** 工具函数复用（本包不依赖 `electron`）。
