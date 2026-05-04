/**
 * Markdown 切片与轻量关键词预过滤（anti-bot 文档「切片 / 预过滤」）。
 * 适合在 Utility Process 或主进程外调用；此处仅纯函数，无 I/O。
 */

const DEFAULT_MAX_CHUNK = 4000;

/**
 * 按空行分段后合并为不超过 `maxChunkChars` 的块（段落边界优先）。
 */
export function chunkMarkdownByParagraphs(markdown: string, maxChunkChars = DEFAULT_MAX_CHUNK): string[] {
  const normalized = markdown.replace(/\r\n/g, "\n").trim();
  if (!normalized) return [];

  const paragraphs = normalized.split(/\n\n+/);
  const chunks: string[] = [];
  let buf = "";

  function flush(): void {
    const t = buf.trim();
    if (t) chunks.push(t);
    buf = "";
  }

  for (const p of paragraphs) {
    const piece = p.trim();
    if (!piece) continue;
    const candidate = buf ? `${buf}\n\n${piece}` : piece;
    if (candidate.length <= maxChunkChars) {
      buf = candidate;
    } else {
      flush();
      if (piece.length <= maxChunkChars) {
        buf = piece;
      } else {
        for (let i = 0; i < piece.length; i += maxChunkChars) {
          chunks.push(piece.slice(i, i + maxChunkChars));
        }
      }
    }
  }
  flush();
  return chunks;
}

/** 简单关键词命中计分（小写、非字母数字边界） */
export function scoreTextForKeywords(text: string, keywords: string[]): number {
  if (!keywords.length) return 1;
  const lower = text.toLowerCase();
  let score = 0;
  for (const k of keywords) {
    const n = k.trim().toLowerCase();
    if (!n) continue;
    let from = 0;
    while (from < lower.length) {
      const i = lower.indexOf(n, from);
      if (i < 0) break;
      score += 1;
      from = i + n.length;
    }
  }
  return score;
}

/**
 * 丢弃得分低于 `minScore` 的块；若全部丢弃则退回原文单块（避免喂给 LLM 空串）。
 */
export function filterChunksByKeywordScore(
  chunks: string[],
  keywords: string[],
  minScore: number
): string[] {
  if (!keywords.length || minScore <= 0) return chunks;
  const kept = chunks.filter((c) => scoreTextForKeywords(c, keywords) >= minScore);
  return kept.length > 0 ? kept : chunks;
}
