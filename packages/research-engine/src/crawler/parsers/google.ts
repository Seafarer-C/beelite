import * as cheerio from "cheerio";
import type { ResearchHit } from "@beelite/shared";

function isGoogleNoiseHost(host: string): boolean {
  return (
    host === "google.com" ||
    host.endsWith(".google.com") ||
    host.endsWith(".gstatic.com") ||
    host === "webcache.googleusercontent.com"
  );
}

function dedupeHits(hits: ResearchHit[]): ResearchHit[] {
  const seen = new Set<string>();
  return hits.filter((h) => {
    if (seen.has(h.url)) return false;
    seen.add(h.url);
    return true;
  });
}

/**
 * Google Web SERP：结构常变，采用「#rso 内 h3 + 最近父级 a」与补充 `div.g` 两套启发式。
 */
export function parseGoogleSerpHtml(html: string, max: number): ResearchHit[] {
  const $ = cheerio.load(html);
  const out: ResearchHit[] = [];
  const seenUrl = new Set<string>();

  function push(url: string, title: string, snippet: string): void {
    if (out.length >= max) return;
    if (!url.startsWith("http://") && !url.startsWith("https://")) return;
    try {
      const host = new URL(url).hostname;
      if (isGoogleNoiseHost(host)) return;
    } catch {
      return;
    }
    if (seenUrl.has(url)) return;
    seenUrl.add(url);
    out.push({
      title: (title || "Untitled").trim(),
      url,
      snippet: snippet.slice(0, 600)
    });
  }

  $("#rso h3").each((_, h3) => {
    if (out.length >= max) return false;
    const $h3 = $(h3);
    const $a = $h3.closest("a[href^='http']").first();
    if (!$a.length) return;
    const href = ($a.attr("href") ?? "").split("#")[0] ?? "";
    const title = $h3.text().trim();
    const $card = $a.closest("div").parent();
    const snippet =
      $card.find("div[style], span, div").first().text().trim().slice(0, 400) || "";
    push(href, title, snippet);
    return undefined;
  });

  if (out.length < max) {
    $("#rso .g a h3, #rso div[data-sokoban-container] a h3").each((_, h3) => {
      if (out.length >= max) return false;
      const $h3 = $(h3);
      const $a = $h3.closest("a[href^='http']");
      if (!$a.length) return;
      const href = ($a.attr("href") ?? "").split("#")[0] ?? "";
      const title = $h3.text().trim();
      const $card = $a.closest("div.g, div[data-hveid]");
      const snippet = $card.find("div.VwiC3b, .s, span").first().text().trim();
      push(href, title, snippet);
      return undefined;
    });
  }

  return dedupeHits(out).slice(0, max);
}

export function htmlLooksLikeGoogleWall(html: string): boolean {
  const t = html.toLowerCase();
  return (
    t.includes("unusual traffic from your computer") ||
    t.includes("detected unusual traffic") ||
    t.includes("/sorry/") ||
    (t.includes("captcha") && t.includes("google"))
  );
}
