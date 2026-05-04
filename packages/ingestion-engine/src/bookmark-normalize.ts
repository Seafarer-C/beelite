import { chromeTimeToIso } from "./ids";

/** 统一规范化树（与 Chrome `Bookmarks` JSON 结构对应，便于存储与 diff） */
export interface NormalizedBookmarkNode {
  kind: "url" | "folder";
  chromeId: string;
  title: string;
  url?: string;
  dateAdded?: string;
  children?: NormalizedBookmarkNode[];
}

export interface NormalizedProfileBookmarks {
  schemaVersion: 1;
  profileName: string;
  bookmarksFilePath: string;
  roots: Record<string, NormalizedBookmarkNode | null>;
}

/** 单浏览器下聚合：各 profile 规范化结果按 profileName 排序组成的数组 */
export type BrowserBookmarkCollections = NormalizedProfileBookmarks[];

interface RawChromeBookmarkNode {
  id?: string;
  type?: string;
  name?: string;
  url?: string;
  date_added?: string;
  children?: RawChromeBookmarkNode[];
}

interface RawChromeBookmarksFile {
  roots?: Record<string, RawChromeBookmarkNode>;
}

export function normalizeChromeBookmarksFile(
  raw: unknown,
  profileName: string,
  bookmarksFilePath: string
): NormalizedProfileBookmarks {
  const file = raw as RawChromeBookmarksFile;
  const rootsIn = file.roots ?? {};
  const rootKeys = Object.keys(rootsIn).sort();
  const roots: Record<string, NormalizedBookmarkNode | null> = {};
  for (const key of rootKeys) {
    roots[key] = normalizeTreeNode(rootsIn[key]);
  }
  return {
    schemaVersion: 1,
    profileName,
    bookmarksFilePath,
    roots
  };
}

function normalizeTreeNode(node: RawChromeBookmarkNode | undefined): NormalizedBookmarkNode | null {
  if (!node) return null;
  const chromeId = typeof node.id === "string" ? node.id : "";
  const title = typeof node.name === "string" ? node.name : "";

  if (node.type === "url" && typeof node.url === "string" && node.url.length > 0) {
    return {
      kind: "url",
      chromeId,
      title,
      url: node.url,
      dateAdded: chromeTimeToIso(node.date_added)
    };
  }

  const rawChildren = node.children ?? [];
  const normalizedChildren = rawChildren
    .map((c) => normalizeTreeNode(c))
    .filter((c): c is NormalizedBookmarkNode => c !== null);

  const sorted = sortChildNodes(normalizedChildren);

  return {
    kind: "folder",
    chromeId,
    title,
    dateAdded: chromeTimeToIso(node.date_added),
    children: sorted.length > 0 ? sorted : undefined
  };
}

function sortChildNodes(nodes: NormalizedBookmarkNode[]): NormalizedBookmarkNode[] {
  return [...nodes].sort((a, b) => compareNodes(a, b));
}

function compareNodes(a: NormalizedBookmarkNode, b: NormalizedBookmarkNode): number {
  const kindOrder = a.kind.localeCompare(b.kind);
  if (kindOrder !== 0) return kindOrder;
  const titleCmp = a.title.localeCompare(b.title, "en");
  if (titleCmp !== 0) return titleCmp;
  const au = a.url ?? "";
  const bu = b.url ?? "";
  return au.localeCompare(bu, "en");
}
