import type { ResearchHit } from "@beelite/shared";
import type { Page } from "playwright";
import { getSharedBrowser, withBrowserLock, closeResearchBrowser } from "./browser-pool";
import { runStaticSearchPipeline } from "./crawler/static-search";
import { parseBingSerpHtml, htmlLooksLikeBingWall } from "./crawler/parsers/bing";
import { parseDdgHtmlSerpToHits, htmlTextLooksLikeDdgWall } from "./crawler/parsers/ddg-regex";
import { parseDdgLiteSerpHtml } from "./crawler/parsers/ddg-lite";

const DDG_LITE_URL = "https://lite.duckduckgo.com/lite/";
const DEFAULT_MAX_TEXT = 120_000;
const LOG_PREFIX = "[research-browser]";

const PLAYWRIGHT_DDG_HTML_URLS: Array<{ name: string; buildUrl: (q: string) => string }> = [
  {
    name: "pw-ddg-html",
    buildUrl: (query) => `https://duckduckgo.com/html/?q=${encodeURIComponent(query)}`
  },
  {
    name: "pw-html-subdomain",
    buildUrl: (query) => `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`
  },
  {
    name: "pw-ddg-lite-path",
    buildUrl: (query) => `https://duckduckgo.com/lite/?q=${encodeURIComponent(query)}`
  }
];

const BING_BOT_MARKERS = ["unusual traffic", "captcha", "验证您的身份", "正在进行人机验证"];

const DDG_ERROR_MARKERS = [
  "if this persists, please email us",
  "anonymized error code",
  "forbidden",
  "temporarily unavailable",
  "rate limit",
  "too many requests"
];

export { closeResearchBrowser };

function clampInt(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(Math.floor(n), max));
}

interface ParseDiag {
  documentTitle: string;
  locationHref: string;
  tableCount: number;
  resultLinkCount: number;
  anchorsHttpInTable: number;
  anchorsHttpPage: number;
  sampleHrefs: string[];
  bodyPreview: string;
  resolvedFromUddg: number;
}

interface ParseOutcome {
  hits: ResearchHit[];
  diag: ParseDiag;
}

function serpOutcomeFromHtml(
  html: string,
  finalUrl: string,
  label: string,
  hits: ResearchHit[]
): ParseOutcome {
  const diag: ParseDiag = {
    documentTitle: label,
    locationHref: finalUrl,
    tableCount: 0,
    resultLinkCount: hits.length,
    anchorsHttpInTable: 0,
    anchorsHttpPage: 0,
    sampleHrefs: hits.slice(0, 5).map((h) => h.url.slice(0, 180)),
    bodyPreview: html.replace(/\s+/g, " ").trim().slice(0, 420),
    resolvedFromUddg: 0
  };
  return { hits, diag };
}

async function pageTextLooksLikeBotWall(page: Page, markers: readonly string[]): Promise<boolean> {
  return page.evaluate((needles) => {
    const t = (document.body?.innerText ?? "").toLowerCase();
    return needles.some((n) => t.includes(n));
  }, [...markers]);
}

function htmlHasDdgErrorMarkers(html: string): boolean {
  const t = html.toLowerCase();
  return DDG_ERROR_MARKERS.some((m) => t.includes(m));
}

function parseOutcomeFromDdgHtml(html: string, max: number, finalUrl: string): ParseOutcome {
  const hits = parseDdgHtmlSerpToHits(html, max);
  return serpOutcomeFromHtml(html, finalUrl, "ddg-html-serp", hits);
}

function parseOutcomeFromBingHtml(html: string, max: number, finalUrl: string): ParseOutcome {
  const hits = parseBingSerpHtml(html, max);
  return serpOutcomeFromHtml(html, finalUrl, "bing-cheerio", hits);
}

function parseOutcomeFromDdgLiteHtml(html: string, max: number, finalUrl: string): ParseOutcome {
  const hits = parseDdgLiteSerpHtml(html, max);
  return serpOutcomeFromHtml(html, finalUrl, "ddg-lite-cheerio", hits);
}

function formatBrowserDebug(
  label: string,
  query: string,
  navUrl: string,
  finalUrl: string,
  httpStatus: number | undefined,
  outcome: ParseOutcome
): string {
  const { diag, hits } = outcome;
  const lines = [
    `[${label}]`,
    `query=${query}`,
    `navigate=${navUrl}`,
    `finalUrl=${finalUrl}`,
    `httpStatus=${httpStatus ?? "?"}`,
    `title=${diag.documentTitle.slice(0, 120)}`,
    `tables=${diag.tableCount} primaryLinks=${diag.resultLinkCount} httpAnchorsPage=${diag.anchorsHttpPage}`,
    `resolvedFromUddgRedirects=${diag.resolvedFromUddg}`,
    `hits=${hits.length}`,
    `bodyPreview=${diag.bodyPreview.slice(0, 280)}`
  ];
  if (diag.sampleHrefs.length > 0) {
    lines.push("sampleHrefs:");
    diag.sampleHrefs.forEach((h, i) => lines.push(`  [${i}] ${h}`));
  }
  return lines.join("\n");
}

export interface BrowserSearchOutcome {
  hits: ResearchHit[];
  debugText: string;
  blockedReason?: string;
}

export async function runBrowserSearch(query: string, count: number): Promise<BrowserSearchOutcome> {
  const q = query.trim();
  if (!q) {
    return { hits: [], debugText: "empty query" };
  }

  const max = clampInt(count, 1, 20);
  const ddgNavUrl = `${DDG_LITE_URL}?q=${encodeURIComponent(q)}`;
  const bingNavUrl = `https://www.bing.com/search?q=${encodeURIComponent(q)}&setlang=zh-hans`;
  const bingNavUrlEn = `https://www.bing.com/search?q=${encodeURIComponent(q)}&setlang=en-us&cc=us`;

  const debugChunks: string[] = [];

  /** 阶段 0：Node fetch + cheerio（Bing → Google → DDG），不占用 Playwright */
  const staticTry = await runStaticSearchPipeline(q, max);
  debugChunks.push(staticTry.debugLines.join("\n"));
  if (staticTry.hits.length > 0) {
    console.info(`${LOG_PREFIX} static SERP ok hits=${staticTry.hits.length}`);
    return { hits: staticTry.hits, debugText: debugChunks.join("\n\n") };
  }

  return withBrowserLock(async () => {
    const browser = await getSharedBrowser();
    const context = await browser.newContext({
      locale: "zh-CN",
      userAgent:
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
    });
    const page = await context.newPage();

    try {
      console.info(`${LOG_PREFIX} Bing zh goto`, bingNavUrl);
      const bingResp = await page.goto(bingNavUrl, { waitUntil: "domcontentloaded", timeout: 45_000 });
      let bingStatus = bingResp?.status();
      let finalUrl = page.url();

      await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {
        console.info(`${LOG_PREFIX} Bing zh networkidle timeout`);
      });
      await page.waitForSelector("#b_results, li.b_algo", { timeout: 12_000 }).catch(() => {
        console.info(`${LOG_PREFIX} Bing zh wait #b_results/li.b_algo timeout`);
      });

      let bingHtml = await page.content();
      let bingAntiBot =
        (await pageTextLooksLikeBotWall(page, BING_BOT_MARKERS)) || htmlLooksLikeBingWall(bingHtml);
      let bingHttpBad = bingStatus !== undefined && (bingStatus < 200 || bingStatus >= 400);
      let bingOutcome = parseOutcomeFromBingHtml(bingHtml, max, finalUrl);
      let hits = bingOutcome.hits.slice(0, max);
      debugChunks.push(formatBrowserDebug("Bing-Web-zh", q, bingNavUrl, finalUrl, bingStatus, bingOutcome));
      debugChunks.push(`bingZhAntiBotWall=${bingAntiBot}`);
      debugChunks.push(`bingZhHttpBad=${bingHttpBad}`);

      if (hits.length === 0 && !bingAntiBot && !bingHttpBad) {
        console.info(`${LOG_PREFIX} Bing zh empty, try Bing en`, bingNavUrlEn);
        const bingEnResp = await page.goto(bingNavUrlEn, { waitUntil: "domcontentloaded", timeout: 45_000 });
        bingStatus = bingEnResp?.status();
        finalUrl = page.url();
        await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {
          console.info(`${LOG_PREFIX} Bing en networkidle timeout`);
        });
        await page.waitForSelector("#b_results, li.b_algo", { timeout: 12_000 }).catch(() => {
          console.info(`${LOG_PREFIX} Bing en wait #b_results/li.b_algo timeout`);
        });
        bingHtml = await page.content();
        const bingEnAntiBot =
          (await pageTextLooksLikeBotWall(page, BING_BOT_MARKERS)) || htmlLooksLikeBingWall(bingHtml);
        const bingEnHttpBad = bingStatus !== undefined && (bingStatus < 200 || bingStatus >= 400);
        bingOutcome = parseOutcomeFromBingHtml(bingHtml, max, finalUrl);
        hits = bingOutcome.hits.slice(0, max);
        bingAntiBot = bingAntiBot || bingEnAntiBot;
        bingHttpBad = bingHttpBad || bingEnHttpBad;
        debugChunks.push(formatBrowserDebug("Bing-Web-en", q, bingNavUrlEn, finalUrl, bingStatus, bingOutcome));
        debugChunks.push(`bingEnAntiBotWall=${bingEnAntiBot}`);
        debugChunks.push(`bingEnHttpBad=${bingEnHttpBad}`);
      }

      const tryDdgFallback = hits.length === 0 || bingAntiBot || bingHttpBad;
      const bingTriggerParts: string[] = [];
      if (hits.length === 0) bingTriggerParts.push("noHits");
      if (bingAntiBot) bingTriggerParts.push("antiBot");
      if (bingHttpBad) bingTriggerParts.push(`http_${bingStatus ?? "?"}`);
      debugChunks.push(`searchFallbackNeed=${tryDdgFallback ? bingTriggerParts.join("+") : "no"}`);

      if (tryDdgFallback) {
        console.warn(
          `${LOG_PREFIX} Bing insufficient (hits=${hits.length} antiBot=${bingAntiBot} httpBad=${bingHttpBad}), trying DDG HTML then Lite`
        );

        let ddgHtmlWorked = false;
        for (const ep of PLAYWRIGHT_DDG_HTML_URLS) {
          const nav = ep.buildUrl(q);
          console.info(`${LOG_PREFIX} DDG HTML (${ep.name})`, nav);
          const resp = await page.goto(nav, { waitUntil: "domcontentloaded", timeout: 45_000 });
          const st = resp?.status();
          finalUrl = page.url();
          await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});
          await page.waitForSelector("body", { timeout: 8_000 }).catch(() => {});

          const html = await page.content();
          if (htmlTextLooksLikeDdgWall(html)) {
            debugChunks.push(`[${ep.name}] wall_or_error_html status=${st ?? "?"}`);
            continue;
          }
          const htmlOutcome = parseOutcomeFromDdgHtml(html, max, finalUrl);
          debugChunks.push(formatBrowserDebug(`DDG-HTML-${ep.name}`, q, nav, finalUrl, st, htmlOutcome));
          if (htmlOutcome.hits.length > 0) {
            hits = htmlOutcome.hits.slice(0, max);
            ddgHtmlWorked = true;
            debugChunks.push(`fallbackUsed=true source=pw-${ep.name}`);
            break;
          }
        }

        if (!ddgHtmlWorked && hits.length === 0) {
          const ddgResp = await page.goto(ddgNavUrl, { waitUntil: "domcontentloaded", timeout: 45_000 });
          const ddgStatus = ddgResp?.status();
          finalUrl = page.url();
          await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {
            console.info(`${LOG_PREFIX} DDG Lite networkidle timeout`);
          });
          await page.waitForSelector("table, a.result-link", { timeout: 12_000 }).catch(() => {
            console.info(`${LOG_PREFIX} DDG Lite wait table/result-link timeout`);
          });

          const ddgHtml = await page.content();
          const ddgAntiBot = htmlTextLooksLikeDdgWall(ddgHtml);
          const ddgErrorPage = htmlHasDdgErrorMarkers(ddgHtml);
          const ddgHttpBad = ddgStatus !== undefined && (ddgStatus < 200 || ddgStatus >= 400);
          const ddgOutcome = parseOutcomeFromDdgLiteHtml(ddgHtml, max, finalUrl);
          debugChunks.push(formatBrowserDebug("DuckDuckGo-Lite", q, ddgNavUrl, finalUrl, ddgStatus, ddgOutcome));
          debugChunks.push(`ddgLiteAntiBotWall=${ddgAntiBot}`);
          debugChunks.push(`ddgLiteErrorPageMarkers=${ddgErrorPage}`);
          debugChunks.push(`ddgLiteHttpBad=${ddgHttpBad}`);

          if (ddgOutcome.hits.length > 0) {
            hits = ddgOutcome.hits.slice(0, max);
            debugChunks.push("fallbackUsed=true source=ddg-lite-cheerio");
          } else if (bingAntiBot && ddgAntiBot) {
            const reason =
              "Bing 与 DuckDuckGo 均触发了人机验证或拦截，无头浏览器无法自动通过。请改用 Research 面板中的 Brave / Tavily / Serper（API Key）搜索，或在系统浏览器中手动搜索。";
            debugChunks.push(`blocked=${reason}`);
            console.error(`${LOG_PREFIX}`, reason);
            return { hits: [], debugText: debugChunks.join("\n\n"), blockedReason: reason };
          } else {
            const reason =
              "已依次尝试：静态 fetch（Bing/Google/DDG）、Playwright Bing（中/英）、DDG HTML、DDG Lite（cheerio 解析），仍无可用结果。建议使用 API 搜索提供商，或在系统浏览器中搜索。";
            debugChunks.push(`blocked=${reason}`);
            console.error(`${LOG_PREFIX}`, reason);
            return { hits: [], debugText: debugChunks.join("\n\n"), blockedReason: reason };
          }
        }
      }

      const debugText = debugChunks.join("\n\n");
      console.info(`${LOG_PREFIX} done hits=${hits.length}`);
      console.info(`${LOG_PREFIX} diagnostics:\n${debugText}`);
      return { hits, debugText };
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      console.error(`${LOG_PREFIX} error`, msg);
      throw error;
    } finally {
      await page.close().catch(() => {});
      await context.close().catch(() => {});
    }
  });
}

interface ExtractedPage {
  title: string;
  text: string;
}

async function cdpExtractReadableText(page: Page): Promise<ExtractedPage> {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Runtime.enable");
  const evalResult = await cdp.send("Runtime.evaluate", {
    expression: `(function () {
      var t = document.title || '';
      var b = document.body;
      if (!b) return { title: t, text: '' };
      var clone = b.cloneNode(true);
      clone.querySelectorAll('script,style,noscript,iframe,svg').forEach(function (el) { el.remove(); });
      var text = (clone.innerText || '').replace(/\\s+/g, ' ').trim();
      return { title: t, text: text };
    })()`,
    returnByValue: true
  });

  if (evalResult.exceptionDetails) {
    const msg = evalResult.exceptionDetails.exception?.description ?? "页面脚本求值失败";
    throw new Error(msg);
  }

  const val = evalResult.result.value as ExtractedPage | undefined;
  if (!val || typeof val !== "object") {
    return { title: "", text: "" };
  }
  return {
    title: String(val.title ?? ""),
    text: String(val.text ?? "")
  };
}

export async function fetchPageTextViaCdp(
  targetUrl: string,
  maxChars: number = DEFAULT_MAX_TEXT
): Promise<{ title: string; text: string; truncated: boolean }> {
  const cap = clampInt(maxChars, 4000, 500_000);

  return withBrowserLock(async () => {
    const browser = await getSharedBrowser();
    const context = await browser.newContext({
      locale: "zh-CN",
      userAgent:
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
    });
    const page = await context.newPage();
    try {
      await page.goto(targetUrl, { waitUntil: "domcontentloaded", timeout: 45_000 });
      await page.waitForLoadState("networkidle", { timeout: 12_000 }).catch(() => {});
      const { title, text } = await cdpExtractReadableText(page);
      let truncated = false;
      let body = text;
      if (body.length > cap) {
        body = body.slice(0, cap);
        truncated = true;
      }
      return { title, text: body, truncated };
    } finally {
      await page.close().catch(() => {});
      await context.close().catch(() => {});
    }
  });
}
