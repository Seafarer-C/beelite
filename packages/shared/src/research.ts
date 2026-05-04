/** 联网搜索后端：API 模式（用户自备 Key）或本地 Chromium（Playwright/CDP） */
export type ResearchSearchProviderKind = "brave" | "tavily" | "serper" | "browser";

export interface ResearchSettingsPublic {
  provider: ResearchSearchProviderKind;
  hasApiKey: boolean;
  /** 非 browser 提供商时需要有效的搜索 API Key */
  needsSearchApiKey: boolean;
}

/** apiKey: null 清除；undefined 不修改 */
export interface ResearchSetSettingsPayload {
  provider?: ResearchSearchProviderKind;
  apiKey?: string | null;
}

export interface ResearchSearchParams {
  query: string;
  /** 每条后端上限不同，主进程会裁剪 */
  count?: number;
}

export interface ResearchHit {
  title: string;
  url: string;
  snippet: string;
}

export interface ResearchSearchResult {
  ok: boolean;
  query: string;
  provider?: ResearchSearchProviderKind;
  results: ResearchHit[];
  error?: string;
  /** provider 为 browser 时：页面诊断与解析摘要（多行文本） */
  browserDebug?: string;
  /** browser 模式：L1=仅协议级 fetch；L2=已使用 Playwright */
  searchLevel?: "L1" | "L2";
  /** browser 模式：多级降级路径摘要 */
  routeTrace?: string[];
}

export interface ResearchFetchPageParams {
  url: string;
  /** 正文最大字符数，默认 120000 */
  maxChars?: number;
}

export interface ResearchFetchPageResult {
  ok: boolean;
  url?: string;
  title?: string;
  /** 经 DOM 提取的正文（CDP Runtime.evaluate） */
  text?: string;
  truncated?: boolean;
  error?: string;
}
