import type { ResearchHit } from "@beelite/shared";

const DDG_BOT_MARKERS = [
  "unfortunately, bots use duckduckgo",
  "bots use duckduckgo too",
  "confirm this search was made by a human"
];

const DDG_ERROR_MARKERS = [
  "if this persists, please email us",
  "anonymized error code",
  "forbidden",
  "temporarily unavailable",
  "rate limit",
  "too many requests"
];

export function htmlTextLooksLikeDdgWall(html: string): boolean {
  const t = html.toLowerCase();
  return (
    DDG_BOT_MARKERS.some((m) => t.includes(m)) || DDG_ERROR_MARKERS.some((m) => t.includes(m))
  );
}

function stripTags(value: string): string {
  return value.replace(/<[^>]+>/g, " ");
}

function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function isDuckDuckGoHost(hostname: string): boolean {
  return hostname === "duckduckgo.com" || hostname.endsWith(".duckduckgo.com");
}

function unwrapDuckDuckGoRedirect(url: string): string {
  if (!url) return "";
  try {
    const parsed = new URL(url, "https://duckduckgo.com");
    if (isDuckDuckGoHost(parsed.hostname)) {
      const redirected =
        parsed.searchParams.get("uddg")?.trim() ||
        parsed.searchParams.get("u")?.trim() ||
        parsed.searchParams.get("u3")?.trim() ||
        "";
      if (redirected) return redirected;
    }
    return parsed.toString();
  } catch {
    return url;
  }
}

function normalizeFetchableSearchUrl(url: string): string {
  if (!url) return "";
  try {
    const parsed = new URL(url, "https://duckduckgo.com");
    if (isDuckDuckGoHost(parsed.hostname)) {
      const redirected = unwrapDuckDuckGoRedirect(parsed.toString());
      if (!redirected || redirected === parsed.toString()) return "";
      return normalizeFetchableSearchUrl(redirected);
    }
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return "";
    return parsed.toString();
  } catch {
    return "";
  }
}

function normalizeSearchResultUrl(rawHref: string): string {
  return normalizeFetchableSearchUrl(unwrapDuckDuckGoRedirect(decodeHtmlEntities(rawHref)));
}

function dedupeHitsByUrl(hits: ResearchHit[]): ResearchHit[] {
  const seen = new Set<string>();
  return hits.filter((h) => {
    if (seen.has(h.url)) return false;
    seen.add(h.url);
    return true;
  });
}

/** DuckDuckGo HTML SERP（result__a / nofollow），与 research-agent-refer 同源 */
export function parseDdgHtmlSerpToHits(html: string, max: number): ResearchHit[] {
  const anchorPatterns = [
    /<a[^>]*class="result__a"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi,
    /<a[^>]*rel="nofollow"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi
  ];
  const raw: ResearchHit[] = [];
  for (const anchorPattern of anchorPatterns) {
    let match: RegExpExecArray | null;
    anchorPattern.lastIndex = 0;
    while ((match = anchorPattern.exec(html)) !== null) {
      const href = decodeHtmlEntities(match[1] ?? "");
      const title = stripTags(decodeHtmlEntities(match[2] ?? "")).trim();
      const url = normalizeSearchResultUrl(href);
      if (!url || !title) continue;
      raw.push({ title: title || "Untitled", url, snippet: "" });
    }
  }
  return dedupeHitsByUrl(raw).slice(0, max);
}
