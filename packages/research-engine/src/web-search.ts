import type { ResearchHit, ResearchSearchProviderKind } from "@beelite/shared";

function clampCount(n: number, max: number): number {
  return Math.max(1, Math.min(Math.floor(n), max));
}

async function searchBrave(apiKey: string, query: string, count: number): Promise<ResearchHit[]> {
  const url = new URL("https://api.search.brave.com/res/v1/web/search");
  url.searchParams.set("q", query);
  url.searchParams.set("count", String(clampCount(count, 20)));

  const res = await fetch(url, {
    headers: {
      Accept: "application/json",
      "X-Subscription-Token": apiKey
    }
  });

  const rawText = await res.text();
  if (!res.ok) {
    throw new Error(`Brave HTTP ${res.status}: ${rawText.slice(0, 280)}`);
  }

  const data = JSON.parse(rawText) as {
    web?: { results?: Array<{ title?: string; url?: string; description?: string }> };
  };

  const rows = data.web?.results ?? [];
  return rows
    .map((r) => ({
      title: String(r.title ?? "").trim() || "Untitled",
      url: String(r.url ?? "").trim(),
      snippet: String(r.description ?? "").trim()
    }))
    .filter((r) => r.url.length > 0);
}

async function searchTavily(apiKey: string, query: string, count: number): Promise<ResearchHit[]> {
  const res = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      api_key: apiKey,
      query,
      max_results: clampCount(count, 20),
      search_depth: "basic",
      include_answer: false
    })
  });

  const rawText = await res.text();
  if (!res.ok) {
    throw new Error(`Tavily HTTP ${res.status}: ${rawText.slice(0, 280)}`);
  }

  const data = JSON.parse(rawText) as {
    results?: Array<{ title?: string; url?: string; content?: string }>;
  };

  const rows = data.results ?? [];
  return rows
    .map((r) => ({
      title: String(r.title ?? "").trim() || "Untitled",
      url: String(r.url ?? "").trim(),
      snippet: String(r.content ?? "").trim()
    }))
    .filter((r) => r.url.length > 0);
}

async function searchSerper(apiKey: string, query: string, count: number): Promise<ResearchHit[]> {
  const res = await fetch("https://google.serper.dev/search", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-API-KEY": apiKey
    },
    body: JSON.stringify({
      q: query,
      num: clampCount(count, 10)
    })
  });

  const rawText = await res.text();
  if (!res.ok) {
    throw new Error(`Serper HTTP ${res.status}: ${rawText.slice(0, 280)}`);
  }

  const data = JSON.parse(rawText) as {
    organic?: Array<{ title?: string; link?: string; snippet?: string }>;
  };

  const rows = data.organic ?? [];
  return rows
    .map((r) => ({
      title: String(r.title ?? "").trim() || "Untitled",
      url: String(r.link ?? "").trim(),
      snippet: String(r.snippet ?? "").trim()
    }))
    .filter((r) => r.url.length > 0);
}

/**
 * 通过官方 HTTP API 执行联网搜索（Brave / Tavily / Serper）。
 * 不包含 `browser` 提供商；浏览器模式请使用 {@link runBrowserSearch}。
 */
export async function runWebSearch(
  provider: ResearchSearchProviderKind,
  apiKey: string,
  query: string,
  count: number
): Promise<ResearchHit[]> {
  const q = query.trim();
  if (!q) return [];

  switch (provider) {
    case "brave":
      return searchBrave(apiKey, q, count);
    case "tavily":
      return searchTavily(apiKey, q, count);
    case "serper":
      return searchSerper(apiKey, q, count);
    case "browser":
      throw new Error("浏览器搜索请使用 runBrowserSearch，而非 runWebSearch");
    default:
      throw new Error(`Unsupported search provider: ${String(provider)}`);
  }
}
