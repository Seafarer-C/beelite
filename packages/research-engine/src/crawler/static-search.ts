import type { ResearchHit } from "@beelite/shared";
import { fetchHtml } from "./fetch-html";
import { parseBingSerpHtml, htmlLooksLikeBingWall } from "./parsers/bing";
import { parseGoogleSerpHtml, htmlLooksLikeGoogleWall } from "./parsers/google";
import {
  htmlTextLooksLikeDdgWall,
  parseDdgHtmlSerpToHits
} from "./parsers/ddg-regex";
import { describeFetchSearchError } from "./errors";

const DDG_LITE_BASE = "https://lite.duckduckgo.com/lite/";

const FETCH_DDGS_ENDPOINTS: Array<{ name: string; buildUrl: (q: string) => string }> = [
  {
    name: "duckduckgo-html",
    buildUrl: (query) => `https://duckduckgo.com/html/?q=${encodeURIComponent(query)}`
  },
  {
    name: "html.duckduckgo.com",
    buildUrl: (query) => `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`
  },
  {
    name: "duckduckgo-lite-html",
    buildUrl: (query) => `https://duckduckgo.com/lite/?q=${encodeURIComponent(query)}`
  },
  {
    name: "lite.duckduckgo.com",
    buildUrl: (query) => `${DDG_LITE_BASE}?q=${encodeURIComponent(query)}`
  }
];

/**
 * 无 Playwright：Node fetch + cheerio/正则 多引擎降级（Bing → Google → DDG）。
 */
export async function runStaticSearchPipeline(
  query: string,
  max: number
): Promise<{ hits: ResearchHit[]; debugLines: string[] }> {
  const lines: string[] = ["[Static-SERP fetch+cheerio]"];
  const q = query.trim();

  const bingZh = `https://www.bing.com/search?q=${encodeURIComponent(q)}&setlang=zh-hans`;
  try {
    const r = await fetchHtml(bingZh);
    lines.push(`bing-zh status=${r.status} ok=${r.ok}`);
    if (r.ok && !htmlLooksLikeBingWall(r.html)) {
      const hits = parseBingSerpHtml(r.html, max);
      if (hits.length > 0) {
        lines.push(`success=bing-zh hits=${hits.length}`);
        return { hits, debugLines: lines };
      }
    } else if (r.ok && htmlLooksLikeBingWall(r.html)) {
      lines.push("bing-zh wall_or_captcha");
    }
  } catch (e) {
    lines.push(`bing-zh err=${describeFetchSearchError(e)}`);
  }

  const bingEn = `https://www.bing.com/search?q=${encodeURIComponent(q)}&setlang=en-us&cc=us`;
  try {
    const r = await fetchHtml(bingEn);
    lines.push(`bing-en status=${r.status} ok=${r.ok}`);
    if (r.ok && !htmlLooksLikeBingWall(r.html)) {
      const hits = parseBingSerpHtml(r.html, max);
      if (hits.length > 0) {
        lines.push(`success=bing-en hits=${hits.length}`);
        return { hits, debugLines: lines };
      }
    }
  } catch (e) {
    lines.push(`bing-en err=${describeFetchSearchError(e)}`);
  }

  const googleUrl = `https://www.google.com/search?q=${encodeURIComponent(q)}&hl=en&num=15&safe=active`;
  try {
    const r = await fetchHtml(googleUrl);
    lines.push(`google status=${r.status} ok=${r.ok}`);
    if (r.ok && !htmlLooksLikeGoogleWall(r.html)) {
      const hits = parseGoogleSerpHtml(r.html, max);
      if (hits.length > 0) {
        lines.push(`success=google hits=${hits.length}`);
        return { hits, debugLines: lines };
      }
    } else if (r.ok && htmlLooksLikeGoogleWall(r.html)) {
      lines.push("google wall_or_sorry");
    }
  } catch (e) {
    lines.push(`google err=${describeFetchSearchError(e)}`);
  }

  const failures: string[] = [];
  let sawOk = false;
  for (const ep of FETCH_DDGS_ENDPOINTS) {
    const url = ep.buildUrl(q);
    try {
      const r = await fetchHtml(url);
      if (!r.ok) {
        failures.push(`${ep.name}: HTTP ${r.status}`);
        continue;
      }
      sawOk = true;
      if (htmlTextLooksLikeDdgWall(r.html)) {
        failures.push(`${ep.name}: bot_or_error_page_html`);
        continue;
      }
      const hits = parseDdgHtmlSerpToHits(r.html, max);
      lines.push(`ddg ${ep.name} hits=${hits.length}`);
      if (hits.length > 0) {
        lines.push(`success=${ep.name}`);
        return { hits, debugLines: lines };
      }
    } catch (e) {
      failures.push(`${ep.name}: ${describeFetchSearchError(e)}`);
    }
  }

  lines.push(`ddg sawHttpOk=${sawOk}`);
  lines.push(`ddg failures=${failures.join(" | ") || "none"}`);
  lines.push("success=false");
  return { hits: [], debugLines: lines };
}
