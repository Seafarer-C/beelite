/**
 * BeeLite 联网搜索与页面正文抓取（无 Electron 依赖，可在 Node 主进程中使用）。
 *
 * 类型定义（ResearchHit、ResearchSearchProviderKind、IPC 载荷等）见 `@beelite/shared`。
 * API 说明见包内 `docs/API.md`。
 */

export { runWebSearch } from "./web-search";
export {
  runBrowserSearch,
  fetchPageTextViaCdp,
  closeResearchBrowser
} from "./browser-search";
export type { BrowserSearchOutcome } from "./browser-search";
export {
  fetchPageMarkdownStatic,
  fetchPageMarkdownViaPlaywright,
  fetchPageMarkdownAuto,
  fetchPageMarkdownPipelineForLlm,
  type FetchMarkdownResult,
  type FetchPageMarkdownPipelineResult
} from "./fetch-markdown";
export { excerptAroundKeywords } from "./crawler/excerpt";
export { pickRandomUserAgent, USER_AGENT_POOL } from "./crawler/http";
export type { ResearchSearchLevel } from "./crawler/search-levels";
export {
  chunkMarkdownByParagraphs,
  scoreTextForKeywords,
  filterChunksByKeywordScore
} from "./crawler/markdown-chunks";
export {
  buildLlmReadyChunks,
  type LlmContentChunk,
  type BuildLlmChunksOptions
} from "./crawler/llm-pipeline";
