import * as cheerio from "cheerio";
import type { ResearchHit } from "@beelite/shared";

function dedupeHits(hits: ResearchHit[]): ResearchHit[] {
  const seen = new Set<string>();
  return hits.filter((h) => {
    if (seen.has(h.url)) return false;
    seen.add(h.url);
    return true;
  });
}

function isBingInternalHost(host: string): boolean {
  return host.endsWith("bing.com") || host.endsWith("microsoft.com");
}

/**
 * Bing Web SERP：与示例脚本一致，用 cheerio 解析 `li.b_algo`。
 */
export function parseBingSerpHtml(html: string, max: number): ResearchHit[] {
  const $ = cheerio.load(html);
  const out: ResearchHit[] = [];

  $("li.b_algo").each((_, li) => {
    if (out.length >= max) return false;
    const $li = $(li);
    const $a = $li.find("h2 a").first();
    const href = ($a.attr("href") ?? "").trim();
    const title = $a.text().trim() || "Untitled";
    if (!href.startsWith("http://") && !href.startsWith("https://")) return;
    try {
      const host = new URL(href).hostname;
      if (isBingInternalHost(host)) return;
    } catch {
      return;
    }
    const snippet =
      $li.find(".b_caption p, .b_snippet, .b_caption .b_snippet").first().text().trim() || "";
    out.push({ title: title || "Untitled", url: href, snippet: snippet.slice(0, 600) });
    return undefined;
  });

  return dedupeHits(out).slice(0, max);
}

export function htmlLooksLikeBingWall(html: string): boolean {
  const t = html.toLowerCase();
  return (
    t.includes("unusual traffic") ||
    t.includes("captcha") ||
    t.includes("验证您的身份") ||
    t.includes("正在进行人机验证")
  );
}
