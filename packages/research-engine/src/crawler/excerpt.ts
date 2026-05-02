/**
 * 按关键词从长文中抽取片段，控制喂给 LLM 的 token 量（避坑指南 §6）。
 */
export function excerptAroundKeywords(
  text: string,
  keywords: string[],
  maxLen: number
): string {
  const t = text.replace(/\s+/g, " ").trim();
  if (t.length <= maxLen) return t;
  const lower = t.toLowerCase();
  const needles = keywords.map((k) => k.trim().toLowerCase()).filter(Boolean);
  if (needles.length === 0) return t.slice(0, maxLen);

  let best = -1;
  for (const n of needles) {
    const i = lower.indexOf(n);
    if (i >= 0 && (best < 0 || i < best)) best = i;
  }
  if (best < 0) return t.slice(0, maxLen);

  const half = Math.floor(maxLen / 2);
  const start = Math.max(0, best - half);
  const end = Math.min(t.length, start + maxLen);
  let slice = t.slice(start, end);
  if (start > 0) slice = `…${slice}`;
  if (end < t.length) slice = `${slice}…`;
  return slice;
}
