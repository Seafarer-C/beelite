import type { Page } from "playwright";
import { pickRandomUserAgent } from "./crawler/http";
import { pageHtmlToMarkdown } from "./crawler/html-to-markdown";
import { excerptAroundKeywords } from "./crawler/excerpt";
import { fetchHtml } from "./crawler/fetch-html";
import { getSharedBrowser, withBrowserLock } from "./browser-pool";
import {
  buildLlmReadyChunks,
  type BuildLlmChunksOptions,
  type LlmContentChunk
} from "./crawler/llm-pipeline";

const DEFAULT_MAX_MD = 12_000;

function clampInt(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(Math.floor(n), max));
}

export interface FetchMarkdownResult {
  title: string;
  markdown: string;
  truncated: boolean;
  /** 静态 fetch 未拿到有效正文时为 true，已尝试或仅需 Playwright */
  staticEmpty: boolean;
  /** 抓取来源 */
  source: "static" | "playwright";
}

/**
 * 仅用 Node fetch + cheerio + turndown（零浏览器），适合静态站点。
 */
export async function fetchPageMarkdownStatic(
  targetUrl: string,
  options?: { maxChars?: number; excerptKeywords?: string[] }
): Promise<{ title: string; markdown: string; truncated: boolean; ok: boolean }> {
  const maxChars = clampInt(options?.maxChars ?? DEFAULT_MAX_MD, 500, 500_000);
  try {
    const r = await fetchHtml(targetUrl, { timeoutMs: 15_000 });
    if (!r.ok) return { title: "", markdown: "", truncated: false, ok: false };
    let { title, markdown } = pageHtmlToMarkdown(r.html);
    const fullLen = markdown.length;
    if (options?.excerptKeywords?.length) {
      markdown = excerptAroundKeywords(markdown, options.excerptKeywords, maxChars);
    } else if (markdown.length > maxChars) {
      markdown = markdown.slice(0, maxChars);
    }
    const md = markdown.trim();
    return {
      title,
      markdown: md,
      truncated: md.length < fullLen,
      ok: md.length > 0
    };
  } catch {
    return { title: "", markdown: "", truncated: false, ok: false };
  }
}

async function extractMarkdownFromPlaywrightPage(
  page: Page,
  maxChars: number,
  excerptKeywords?: string[]
): Promise<{ title: string; markdown: string; truncated: boolean }> {
  await page.waitForLoadState("networkidle", { timeout: 12_000 }).catch(() => {});
  const html = await page.content();
  let { title, markdown } = pageHtmlToMarkdown(html);
  const fullLen = markdown.length;
  if (excerptKeywords?.length) {
    markdown = excerptAroundKeywords(markdown, excerptKeywords, maxChars);
  } else if (markdown.length > maxChars) {
    markdown = markdown.slice(0, maxChars);
  }
  const md = markdown.trim();
  return {
    title,
    markdown: md,
    truncated: md.length < fullLen
  };
}

/**
 * Playwright 打开页面后，对完整 DOM 做 cheerio 降噪 + turndown（动态站、反爬简单场景）。
 */
export async function fetchPageMarkdownViaPlaywright(
  targetUrl: string,
  options?: { maxChars?: number; excerptKeywords?: string[] }
): Promise<{ title: string; markdown: string; truncated: boolean }> {
  const maxChars = clampInt(options?.maxChars ?? DEFAULT_MAX_MD, 500, 500_000);

  return withBrowserLock(async () => {
    const browser = await getSharedBrowser();
    const context = await browser.newContext({
      locale: "zh-CN",
      userAgent: pickRandomUserAgent()
    });
    const page = await context.newPage();
    try {
      await page.goto(targetUrl, { waitUntil: "domcontentloaded", timeout: 45_000 });
      return await extractMarkdownFromPlaywrightPage(page, maxChars, options?.excerptKeywords);
    } finally {
      await page.close().catch(() => {});
      await context.close().catch(() => {});
    }
  });
}

/**
 * 推荐路径：先静态（快、省资源），正文过短再 Playwright（SPA / 懒加载）。
 */
export async function fetchPageMarkdownAuto(
  targetUrl: string,
  options?: { maxChars?: number; excerptKeywords?: string[]; minStaticChars?: number }
): Promise<FetchMarkdownResult> {
  const minStatic = options?.minStaticChars ?? 400;
  const st = await fetchPageMarkdownStatic(targetUrl, options);
  if (st.ok && st.markdown.length >= minStatic) {
    return {
      title: st.title,
      markdown: st.markdown,
      truncated: st.truncated,
      staticEmpty: false,
      source: "static"
    };
  }

  const pw = await fetchPageMarkdownViaPlaywright(targetUrl, options);
  return {
    title: pw.title,
    markdown: pw.markdown,
    truncated: pw.truncated,
    staticEmpty: !st.ok,
    source: "playwright"
  };
}

export interface FetchPageMarkdownPipelineResult extends FetchMarkdownResult {
  chunks: LlmContentChunk[];
}

/**
 * 抓取 → Markdown → 按段落切片并带来源（便于 LLM / 向量层；见 docs/anti-bot.md）。
 */
export async function fetchPageMarkdownPipelineForLlm(
  targetUrl: string,
  options?: {
    maxChars?: number;
    excerptKeywords?: string[];
    minStaticChars?: number;
    chunk?: BuildLlmChunksOptions;
  }
): Promise<FetchPageMarkdownPipelineResult> {
  const base = await fetchPageMarkdownAuto(targetUrl, options);
  const chunks = buildLlmReadyChunks(
    base.markdown,
    targetUrl,
    base.title,
    options?.chunk
  );
  return { ...base, chunks };
}
