import { chunkMarkdownByParagraphs, filterChunksByKeywordScore } from "./markdown-chunks";

export { scoreTextForKeywords } from "./markdown-chunks";

/** 供引用溯源：每段 Markdown 带来源 URL / 标题（anti-bot 文档 §4 / §5） */
export interface LlmContentChunk {
  index: number;
  markdown: string;
  sourceUrl: string;
  sourceTitle: string;
  charCount: number;
}

export interface BuildLlmChunksOptions {
  maxChunkChars?: number;
  /** 主题词；提供时先做块级过滤再编号 */
  topicKeywords?: string[];
  /** 与 `topicKeywords` 联用，块得分低于此则丢弃（默认 1=至少命中一次） */
  minKeywordScore?: number;
}

/**
 * 将整页 Markdown 切成带来源的块，便于逐块喂 LLM 或建向量索引。
 */
export function buildLlmReadyChunks(
  markdown: string,
  sourceUrl: string,
  sourceTitle: string,
  options?: BuildLlmChunksOptions
): LlmContentChunk[] {
  const maxChunk = options?.maxChunkChars ?? 4000;
  let parts = chunkMarkdownByParagraphs(markdown, maxChunk);
  if (options?.topicKeywords?.length) {
    const min = options.minKeywordScore ?? 1;
    parts = filterChunksByKeywordScore(parts, options.topicKeywords, min);
  }

  return parts.map((md, i) => ({
    index: i,
    markdown: md,
    sourceUrl,
    sourceTitle,
    charCount: md.length
  }));
}
