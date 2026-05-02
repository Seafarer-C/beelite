import * as cheerio from "cheerio";
import type { ResearchHit } from "@beelite/shared";

function resolveTargetUrl(href: string): string | null {
  let u = href.trim();
  if (!u) return null;
  if (u.startsWith("//")) u = `https:${u}`;
  if (!u.startsWith("http://") && !u.startsWith("https://")) return null;
  try {
    const parsed = new URL(u);
    if (parsed.hostname.includes("duckduckgo.com") && parsed.pathname.startsWith("/l/")) {
      const uddg = parsed.searchParams.get("uddg");
      if (uddg) {
        try {
          const inner = new URL(uddg);
          if (inner.hostname.includes("duckduckgo.com")) return null;
          return inner.href;
        } catch {
          return null;
        }
      }
      return null;
    }
    if (parsed.hostname.includes("duckduckgo.com")) return null;
    return u;
  } catch {
    return null;
  }
}

/**
 * DuckDuckGo Lite 表格式 SERP（cheerio，对齐原 Playwright evaluate 逻辑）。
 */
export function parseDdgLiteSerpHtml(html: string, max: number): ResearchHit[] {
  const $ = cheerio.load(html);
  const out: ResearchHit[] = [];
  const seen = new Set<string>();

  function push(title: string, rawHref: string, snippet: string): void {
    const resolved = resolveTargetUrl(rawHref);
    if (!title.trim() || !resolved) return;
    if (seen.has(resolved)) return;
    seen.add(resolved);
    out.push({
      title: title.trim() || "Untitled",
      url: resolved,
      snippet: snippet.trim().slice(0, 600)
    });
  }

  $("a.result-link").each((_, a) => {
    if (out.length >= max) return false;
    const $a = $(a);
    const href = $a.attr("href") ?? "";
    const title = $a.text().trim();
    const $tr = $a.closest("tr");
    const $next = $tr.next("tr");
    const snippet = $next.text().trim();
    push(title, href, snippet);
    return undefined;
  });

  if (out.length < max) {
    $("table a[href^='http']").each((_, a) => {
      if (out.length >= max) return false;
      const $a = $(a);
      const cls = $a.attr("class") ?? "";
      if (cls.includes("hidden")) return;
      const href = $a.attr("href") ?? "";
      const title = $a.text().trim();
      push(title, href, "");
      return undefined;
    });
  }

  if (out.length < max) {
    $("a[href^='http']").each((_, a) => {
      if (out.length >= max) return false;
      const $a = $(a);
      if ($a.closest("header").length || $a.closest("nav").length) return;
      const href = $a.attr("href") ?? "";
      const title = $a.text().trim();
      push(title, href, "");
      return undefined;
    });
  }

  return out.slice(0, max);
}
