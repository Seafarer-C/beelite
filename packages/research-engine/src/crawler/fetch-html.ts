import { buildHtmlFetchHeaders } from "./http";

export interface FetchHtmlResult {
  ok: boolean;
  status: number;
  html: string;
  finalUrl: string;
}

/**
 * Node fetch + 随机 UA；用于静态 SERP / 静态正文（失败则由 Playwright 兜底）。
 */
export async function fetchHtml(
  url: string,
  options?: { timeoutMs?: number; signal?: AbortSignal }
): Promise<FetchHtmlResult> {
  const timeoutMs = options?.timeoutMs ?? 18_000;
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      headers: buildHtmlFetchHeaders(),
      redirect: "follow",
      signal: options?.signal ?? controller.signal
    });
    const html = await res.text();
    return {
      ok: res.ok,
      status: res.status,
      html,
      finalUrl: res.url || url
    };
  } finally {
    clearTimeout(t);
  }
}
