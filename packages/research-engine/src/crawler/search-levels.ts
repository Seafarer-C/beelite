/**
 * 与 docs/anti-bot.md 中的 L1/L2 策略对应：
 * - **L1**：协议级（Node fetch + cheerio/正则），无浏览器
 * - **L2**：Playwright Chromium 真浏览器（更接近真实用户，用于 L1 无结果或疑似封控）
 */
export type ResearchSearchLevel = "L1" | "L2";

export const SEARCH_LEVEL_L1: ResearchSearchLevel = "L1";
export const SEARCH_LEVEL_L2: ResearchSearchLevel = "L2";
