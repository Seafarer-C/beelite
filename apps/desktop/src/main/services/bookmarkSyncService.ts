import type { BrowserBookmarkCollections } from "@beelite/ingestion-engine";
import { normalizeChromeBookmarksFile } from "@beelite/ingestion-engine";
import type {
  BrowserBookmarkChangeLogRow,
  KnowledgeRepository
} from "@beelite/storage-engine";
import { createHash } from "node:crypto";
import { create } from "jsondiffpatch";
import { loadAllChromiumRawBookmarkFiles } from "./localBrowserBookmarks";

const BOOKMARK_BACKGROUND_DELAY_MS = 2000;

const diffpatcher = create({
  arrays: { detectMove: true, includeValueOnMove: false },
  objectHash: (obj: object) => {
    const rec = obj as Record<string, unknown>;
    if (typeof rec.chromeId === "string" && rec.chromeId.length > 0) return rec.chromeId;
    if (typeof rec.profileName === "string") return rec.profileName;
    if (typeof rec.bookmarksFilePath === "string") return rec.bookmarksFilePath;
    return JSON.stringify(obj).slice(0, 120);
  }
});

function stableSortDeep(value: unknown): unknown {
  if (value === null || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map(stableSortDeep);
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  const out: Record<string, unknown> = {};
  for (const k of keys) {
    out[k] = stableSortDeep(obj[k]);
  }
  return out;
}

export function hashBookmarkCollections(collections: unknown): string {
  const sorted = stableSortDeep(collections);
  return createHash("sha256").update(JSON.stringify(sorted)).digest("hex");
}

export async function syncBrowserBookmarksToRepository(repo: KnowledgeRepository): Promise<void> {
  const rawFiles = await loadAllChromiumRawBookmarkFiles();
  const byBrowser = new Map<string, { profiles: BrowserBookmarkCollections }>();

  for (const row of rawFiles) {
    const norm = normalizeChromeBookmarksFile(row.raw, row.profileName, row.bookmarksFilePath);
    let g = byBrowser.get(row.browserKey);
    if (!g) {
      g = { profiles: [] };
      byBrowser.set(row.browserKey, g);
    }
    g.profiles.push(norm);
  }

  for (const [browserKey, { profiles }] of byBrowser) {
    profiles.sort((a, b) => a.profileName.localeCompare(b.profileName, "en"));
    const collections: BrowserBookmarkCollections = profiles;
    const hash = hashBookmarkCollections(collections);
    const existing = repo.getBrowserBookmarkSnapshot(browserKey);

    if (existing && existing.contentHash === hash) {
      continue;
    }

    const now = new Date().toISOString();
    let deltaJson: unknown | null = null;
    if (existing) {
      deltaJson = diffpatcher.diff(existing.collections, collections) ?? null;
    }

    repo.upsertBrowserBookmarkSnapshot({
      id: browserKey,
      browserType: browserKey,
      collections,
      contentHash: hash,
      updatedAt: now
    });

    const logRow: Omit<BrowserBookmarkChangeLogRow, "id"> = {
      browserType: browserKey,
      occurredAt: now,
      previousHash: existing?.contentHash ?? null,
      newHash: hash,
      deltaJson,
      summary: existing ? (deltaJson != null ? "jsondiffpatch" : "hash_mismatch_resync") : "initial"
    };

    repo.appendBrowserBookmarkChangeLog(logRow);
  }
}

export function scheduleBrowserBookmarkSync(getRepo: () => KnowledgeRepository | undefined): void {
  setTimeout(() => {
    const repo = getRepo();
    if (!repo) return;
    void syncBrowserBookmarksToRepository(repo).catch((error) => {
      console.error("[bookmark-sync]", error);
    });
  }, BOOKMARK_BACKGROUND_DELAY_MS);
}
