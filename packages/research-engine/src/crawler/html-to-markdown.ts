import * as cheerio from "cheerio";
import TurndownService from "turndown";

const turndown = new TurndownService({
  headingStyle: "atx",
  codeBlockStyle: "fenced",
  bulletListMarker: "-"
});

/**
 * 移除导航/脚本等噪音后，将主体 HTML 转为 Markdown（LLM 友好）。
 */
export function htmlFragmentToMarkdown(htmlFragment: string | undefined | null): string {
  if (!htmlFragment?.trim()) return "";
  return turndown.turndown(htmlFragment).replace(/\n{3,}/g, "\n\n").trim();
}

export interface PageMarkdownResult {
  title: string;
  markdown: string;
}

/**
 * 优先 article / main，否则 body；先 cheerio 剔除 script/style/nav 等再 turndown。
 */
export function pageHtmlToMarkdown(html: string): PageMarkdownResult {
  const $ = cheerio.load(html);
  const title = $("title").first().text().trim() || "";

  $("script, style, nav, footer, header, iframe, noscript, svg").remove();

  const article = $("article").first();
  const main = $("main").first();
  const body = $("body").first();

  let fragment: string;
  if (article.length && article.html()) {
    fragment = article.html() ?? "";
  } else if (main.length && main.html()) {
    fragment = main.html() ?? "";
  } else {
    fragment = body.html() ?? $.root().html() ?? "";
  }

  return {
    title,
    markdown: htmlFragmentToMarkdown(fragment)
  };
}
