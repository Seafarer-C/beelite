在 Electron 中实现一套具备“多级降级爬虫策略”的 LLM 联网方案，建议采用**“任务编排层 + 独立抓取进程 + 缓存向量层”**的架构。

以下是为你设计的 Electron 联网搜索“黄金架构”：

---

## 1. 核心架构拓扑图

在初建期，最忌讳把爬虫逻辑、LLM 逻辑和 UI 逻辑全部堆在 `main.js`。你应该将功能模块解耦：



*   **Renderer Process (UI 层)**：React/Vue 界面，负责流式展示（Stream）和引用来源显示。
*   **Main Process (调度层)**：负责 IPC 通信、API Key 管理和全局状态。
*   **Utility Process (抓取工进程)**：这是 Electron 的高级特性，允许你在主进程之外运行一个原生的 Node.js 进程，专门处理高负载的爬虫和文本清洗任务，即使爬虫挂了也不会导致应用崩溃。

---

## 2. 模块化设计方案

### A. 策略调度器 (Strategy Orchestrator)
你需要一个状态机来管理 L1 -> L4 的升级。

```javascript
// 伪逻辑架构
class SearchOrchestrator {
  async execute(query) {
    let context = "";
    // 1. 尝试 L1: 协议级 (DuckDuckGo/SearXNG)
    let result = await this.crawler.l1(query);
    
    // 2. 判定是否被封控
    if (this.isBlocked(result)) {
      // 3. 升级到 L2/L3: 隐藏 BrowserWindow 模拟
      result = await this.crawler.l2_l3(query);
    }
    
    // 4. 文本清洗与摘要
    context = await this.processor.cleanAndSummarize(result);
    return context;
  }
}
```

### B. 抓取与降噪管线 (Crawl & Clean Pipe)
为了防止 LLM 被 HTML 垃圾淹没，你需要一套标准管线：
1.  **抓取**：获取原始 HTML。
2.  **提取**：使用 `cheerio` 提取 `title` 和 `article/main` 内容。
3.  **转译**：使用 `turndown` 转化为 Markdown。
4.  **切片 (Chunking)**：如果 Markdown 超过 4k 字符，按段落切分。
5.  **预过滤**：用一个极小的本地模型（或简单的关键词评分）过滤掉无关段落。

---

## 3. 技术选型建议 (初期阶段)

| 组件 | 推荐工具 | 理由 |
| :--- | :--- | :--- |
| **LLM SDK** | `Vercel AI SDK` 或 `LangChain.js` | 统一了不同模型的调用接口，自带工具调用（Tool Calling）逻辑。 |
| **搜索入口** | **SearXNG** (自建) 或 **DuckDuckGo** | 免去 Google 复杂的验证码，且数据格式相对整洁。 |
| **内容处理** | `Cheerio` + `Turndown` | 轻量级，在 Node.js 环境下运行极快。 |
| **本地数据库** | `Lowdb` 或 `PouchDB` | 存储搜索历史和已抓取的网页缓存，避免重复抓取。 |
| **拟人化控制** | `playwright-electron` | 如果 L1 失败，它能直接操作 Electron 窗口，避开 WebDriver 检测。 |

---

## 4. 初期搭建的 3 个关键点

### 1. 善用 Electron 的 `session` 隔离
为你的爬虫模块创建一个独立的 `partition`：
```javascript
const { session } = require('electron');
const searchSession = session.fromPartition('persist:search_bot');
// 这样可以单独清理 Cookie、设置代理，而不影响用户的正常浏览。
```

### 2. 定义清晰的 IPC 协议
在 `preload.js` 中定义好接口，例如：
*   `search:start`: 通知 UI 开始搜索。
*   `search:progress`: 实时发送“正在抓取第 N 个网页...”。
*   `search:result`: 发送清洗后的 Markdown。

### 3. 处理流式输出 (Streaming)
联网搜索会增加延迟。架构上必须支持 **LLM 流式输出**。在等待爬虫结果时，UI 应该显示 Skeleton（骨架屏）或实时滚动日志，以缓解用户焦虑。

---

## 5. 避坑指南（现在就要注意）

*   **不要在主进程做耗时运算**：HTML 解析（特别是正则处理大文本）非常吃 CPU，务必放在子进程或 `UtilityProcess`。
*   **注意内存泄漏**：`BrowserWindow` 抓取完后记得手动 `destroy()`，否则长时间运行后 Electron 会吃掉好几个 GB 的内存。
*   **引用溯源**：在初期设计数据结构时，就要为每个片段带上 `source_url` 和 `source_title`，否则后面做“引用标注”会非常痛苦。

---

## 6. 与本仓库 `@beelite/research-engine` 的对应关系（已实现）

| 文档概念 | 代码位置 |
| :--- | :--- |
| L1 协议级（fetch + cheerio / 正则 SERP） | `crawler/static-search.ts`、`crawler/fetch-html.ts`、`crawler/parsers/*` |
| L2 Playwright 升级 | `browser-search.ts`：静态无命中后 `withBrowserLock` + Chromium；返回 `searchLevel: "L2"`、`routeTrace` |
| 仅 L1 成功 | `runBrowserSearch` 命中静态流水线时 `searchLevel: "L1"` |
| 抓取 → cheerio 提取 → turndown | `crawler/html-to-markdown.ts` |
| 切片（约 4k）+ 关键词预过滤 | `crawler/markdown-chunks.ts`、`crawler/llm-pipeline.ts`（`buildLlmReadyChunks`，含 `sourceUrl` / `sourceTitle`） |
| 整页抓取后切块喂 LLM | `fetchPageMarkdownPipelineForLlm`（`fetch-markdown.ts`） |
| 主进程 IPC 透出降级信息 | `@beelite/shared` 的 `ResearchSearchResult.searchLevel` / `routeTrace`；`researchSettingsStore.search` 透传 |

**尚未在包内实现（需在 `apps/desktop` 做）**：`UtilityProcess` / 独立抓取子进程、`session.fromPartition('persist:search_bot')`、`search:progress` 等流式 IPC。CPU 密集解析可逐步迁到子进程，本包已提供无 I/O 的纯函数（`markdown-chunks`、`llm-pipeline`）便于迁移。
