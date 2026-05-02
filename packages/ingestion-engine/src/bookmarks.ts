import { createGraphProposal } from "@beelite/graph-engine";
import type { KnowledgeEdge, KnowledgeNode, KnowledgeSource } from "@beelite/shared";
import { chromeTimeToIso, compactText, nowIso, stableId } from "./ids";
import type { ParsedBookmark, ParsedBookmarkFolder, ParsedImport } from "./types";

interface ChromeBookmarkNode {
  id?: string;
  type?: "url" | "folder";
  name?: string;
  url?: string;
  date_added?: string;
  children?: ChromeBookmarkNode[];
}

interface ChromeBookmarksExport {
  roots?: Record<string, ChromeBookmarkNode>;
}

export function parseBrowserBookmarks(raw: unknown): {
  folders: ParsedBookmarkFolder[];
  bookmarks: ParsedBookmark[];
} {
  const folders: ParsedBookmarkFolder[] = [];
  const bookmarks: ParsedBookmark[] = [];
  const root = raw as ChromeBookmarksExport;
  const roots = root.roots ?? {};

  Object.entries(roots).forEach(([rootName, node]) => {
    walkBookmarkNode(node, [normalizeRootName(rootName, node.name)], folders, bookmarks);
  });

  return { folders, bookmarks };
}

export function buildBrowserBookmarksImport(raw: unknown, filePath?: string): ParsedImport {
  const parsed = parseBrowserBookmarks(raw);
  const createdAt = nowIso();
  const folderSources = parsed.folders.map<KnowledgeSource>((folder) => ({
    id: `source-${folder.id}`,
    type: "browser_folder",
    title: folder.title,
    path: filePath,
    importedAt: createdAt,
    metadata: {
      folderPath: folder.folderPath,
      childrenCount: folder.childrenCount,
      addedAt: folder.addedAt
    }
  }));
  const bookmarkSources = parsed.bookmarks.map<KnowledgeSource>((bookmark) => ({
    id: `source-${bookmark.id}`,
    type: "browser_bookmark",
    title: bookmark.title,
    path: filePath,
    url: bookmark.url,
    importedAt: createdAt,
    metadata: {
      folderPath: bookmark.folderPath,
      addedAt: bookmark.addedAt
    }
  }));
  const sources = [...folderSources, ...bookmarkSources];
  const folderNodes = parsed.folders.map((folder) => createFolderNode(folder, createdAt));
  const bookmarkNodes = parsed.bookmarks.map((bookmark) => createBookmarkNode(bookmark, createdAt));
  const nodes = [...folderNodes, ...bookmarkNodes];
  const edges = createBookmarkEdges(parsed.folders, parsed.bookmarks, createdAt);
  const proposal = createGraphProposal({
    id: stableId("proposal-bookmarks", [filePath, parsed.bookmarks.length, createdAt]),
    title: "浏览器收藏夹知识提议",
    sourceIds: sources.map((source) => source.id),
    nodes,
    edges,
    openQuestions: [
      "哪些收藏夹目录代表稳定的一级知识领域？",
      "哪些网页只是临时资料，应该归档而不是进入核心知识图谱？"
    ],
    warnings:
      parsed.bookmarks.length === 0
        ? ["没有解析到 URL 收藏项，请确认文件是 Chromium/Chrome Bookmarks JSON。"]
        : []
  });

  return {
    kind: "browser_bookmarks",
    title: "浏览器收藏夹",
    sources,
    nodes,
    edges,
    proposal,
    warnings: proposal.warnings
  };
}

function walkBookmarkNode(
  node: ChromeBookmarkNode | undefined,
  folderPath: string[],
  folders: ParsedBookmarkFolder[],
  bookmarks: ParsedBookmark[]
): void {
  if (!node) return;

  const title = compactText(node.name || folderPath[folderPath.length - 1] || "Untitled", 120);

  if (node.type === "url" && node.url) {
    bookmarks.push({
      id: stableId("bookmark", [node.id, title, node.url]),
      title,
      url: node.url,
      folderPath,
      addedAt: chromeTimeToIso(node.date_added)
    });
    return;
  }

  const nextPath = title === folderPath[folderPath.length - 1] ? folderPath : [...folderPath, title];
  const children = node.children ?? [];

  if (children.length > 0) {
    folders.push({
      id: stableId("bookmark-folder", [node.id, nextPath.join("/")]),
      title,
      folderPath: nextPath,
      addedAt: chromeTimeToIso(node.date_added),
      childrenCount: children.length
    });
  }

  children.forEach((child) => walkBookmarkNode(child, nextPath, folders, bookmarks));
}

function normalizeRootName(rootName: string, nodeName?: string): string {
  if (nodeName && nodeName.trim().length > 0) return nodeName;
  const labels: Record<string, string> = {
    bookmark_bar: "书签栏",
    other: "其他书签",
    synced: "移动设备书签"
  };
  return labels[rootName] ?? rootName;
}

function createFolderNode(folder: ParsedBookmarkFolder, createdAt: string): KnowledgeNode {
  return {
    id: `node-${folder.id}`,
    type: "topic",
    title: folder.title,
    summary: compactText(`浏览器收藏夹目录：${folder.folderPath.join(" / ")}`, 220),
    confidence: 0.7,
    importance: Math.min(0.92, 0.4 + folder.childrenCount / 30),
    freshness: 0.68,
    createdAt,
    updatedAt: createdAt,
    sourceRefs: [`source-${folder.id}`],
    tags: ["Bookmark", "Folder"],
    aliases: [],
    relationIds: [],
    spaceIds: ["space-root"],
    metadata: {
      importer: "browser_bookmarks",
      folderPath: folder.folderPath,
      addedAt: folder.addedAt,
      childrenCount: folder.childrenCount
    }
  };
}

function createBookmarkNode(bookmark: ParsedBookmark, createdAt: string): KnowledgeNode {
  const domain = safeDomain(bookmark.url);

  return {
    id: `node-${bookmark.id}`,
    type: "concept",
    title: bookmark.title,
    summary: compactText(`${domain ? `${domain} · ` : ""}${bookmark.url}`, 260),
    confidence: 0.58,
    importance: 0.5,
    freshness: 0.66,
    createdAt,
    updatedAt: createdAt,
    sourceRefs: [`source-${bookmark.id}`],
    tags: ["Bookmark", domain].filter((tag): tag is string => Boolean(tag)),
    aliases: [],
    relationIds: [],
    spaceIds: ["space-root"],
    metadata: {
      importer: "browser_bookmarks",
      url: bookmark.url,
      folderPath: bookmark.folderPath,
      addedAt: bookmark.addedAt
    }
  };
}

function createBookmarkEdges(
  folders: ParsedBookmarkFolder[],
  bookmarks: ParsedBookmark[],
  createdAt: string
): KnowledgeEdge[] {
  const folderByPath = new Map(folders.map((folder) => [folder.folderPath.join("/"), folder]));
  const edges: KnowledgeEdge[] = [];

  bookmarks.forEach((bookmark) => {
    const folder = folderByPath.get(bookmark.folderPath.join("/"));
    if (!folder) return;

    edges.push({
      id: stableId("edge-bookmark", [folder.id, bookmark.id]),
      sourceId: `node-${bookmark.id}`,
      targetId: `node-${folder.id}`,
      relationType: "sub_topic_of",
      weight: 0.62,
      confidence: 0.72,
      evidenceRefs: [{ sourceId: `source-${bookmark.id}`, confidence: 0.72 }],
      createdBy: "system",
      createdAt
    });
  });

  folders.forEach((folder) => {
    if (folder.folderPath.length <= 1) return;

    const parentPath = folder.folderPath.slice(0, -1).join("/");
    const parent = folderByPath.get(parentPath);
    if (!parent) return;

    edges.push({
      id: stableId("edge-bookmark-folder", [parent.id, folder.id]),
      sourceId: `node-${folder.id}`,
      targetId: `node-${parent.id}`,
      relationType: "sub_topic_of",
      weight: 0.72,
      confidence: 0.8,
      evidenceRefs: [{ sourceId: `source-${folder.id}`, confidence: 0.78 }],
      createdBy: "system",
      createdAt
    });
  });

  return edges;
}

function safeDomain(url: string): string | undefined {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return undefined;
  }
}
