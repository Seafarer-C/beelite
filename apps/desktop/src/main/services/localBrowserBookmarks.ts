import { parseBrowserBookmarks } from "@beelite/ingestion-engine";
import { existsSync } from "node:fs";
import { readdir, readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";

/** 主进程从本机用户目录枚举 Chromium 系浏览器的 Bookmarks（JSON）文件并解析统计 */
export interface LocalChromiumBookmarkProfile {
  browserKey: string;
  browserLabel: string;
  userDataDir: string;
  profileName: string;
  profileDir: string;
  bookmarksFilePath: string;
  fileExists: boolean;
  folderCount?: number;
  urlBookmarkCount?: number;
  error?: string;
  sampleBookmarks?: Array<{ title: string; url: string }>;
}

export interface LocalBookmarksPreview {
  ok: boolean;
  bookmarksFilePath: string;
  folderCount: number;
  urlBookmarkCount: number;
  sampleBookmarks: Array<{ title: string; url: string }>;
  error?: string;
}

/** win32 / linux 可为空字符串表示当前仓库暂未维护可靠路径，扫描时跳过 */
type PathSpec = { darwin: string; win32: string; linux: string };

const CHROMIUM_BROWSERS: Array<{ key: string; label: string; paths: PathSpec }> = [
  {
    key: "chrome",
    label: "Google Chrome",
    paths: {
      darwin: "Library/Application Support/Google/Chrome",
      win32: "Google/Chrome/User Data",
      linux: ".config/google-chrome"
    }
  },
  {
    key: "chrome_canary",
    label: "Google Chrome Canary",
    paths: {
      darwin: "Library/Application Support/Google/Chrome Canary",
      win32: "Google/Chrome SxS/User Data",
      linux: ".config/google-chrome-canary"
    }
  },
  {
    key: "chromium",
    label: "Chromium",
    paths: {
      darwin: "Library/Application Support/Chromium",
      win32: "Chromium/User Data",
      linux: ".config/chromium"
    }
  },
  {
    key: "edge",
    label: "Microsoft Edge",
    paths: {
      darwin: "Library/Application Support/Microsoft Edge",
      win32: "Microsoft/Edge/User Data",
      linux: ".config/microsoft-edge"
    }
  },
  {
    key: "brave",
    label: "Brave",
    paths: {
      darwin: "Library/Application Support/BraveSoftware/Brave-Browser",
      win32: "BraveSoftware/Brave-Browser/User Data",
      linux: ".config/BraveSoftware/Brave-Browser"
    }
  },
  {
    key: "vivaldi",
    label: "Vivaldi",
    paths: {
      darwin: "Library/Application Support/Vivaldi",
      win32: "Vivaldi/User Data",
      linux: ".config/vivaldi"
    }
  },
  {
    key: "arc",
    label: "Arc",
    paths: {
      darwin: "Library/Application Support/Arc/User Data",
      win32: "",
      linux: ""
    }
  },
  {
    key: "opera",
    label: "Opera",
    paths: {
      darwin: "Library/Application Support/com.operasoftware.Opera",
      // Windows 下 Opera 书签通常在 Roaming
      win32: "__APPDATA__/Opera Software/Opera Stable",
      linux: ".config/opera"
    }
  }
];

function resolveUserDataRoot(spec: PathSpec): string | null {
  const home = homedir();
  if (process.platform === "win32") {
    if (!spec.win32) return null;
    if (spec.win32.startsWith("__APPDATA__/")) {
      const appData = process.env.APPDATA;
      if (!appData) return null;
      return join(appData, spec.win32.slice("__APPDATA__/".length));
    }
    const local = process.env.LOCALAPPDATA;
    if (!local) return null;
    return join(local, spec.win32);
  }
  if (process.platform === "darwin") {
    return join(home, spec.darwin);
  }
  if (!spec.linux) return null;
  return join(home, spec.linux);
}

async function parseBookmarksAtPath(bookmarksFilePath: string): Promise<{
  folderCount: number;
  urlBookmarkCount: number;
  sampleBookmarks: Array<{ title: string; url: string }>;
}> {
  const raw = JSON.parse(await readFile(bookmarksFilePath, "utf8")) as unknown;
  const parsed = parseBrowserBookmarks(raw);
  const sampleBookmarks = parsed.bookmarks.slice(0, 16).map((b) => ({
    title: b.title,
    url: b.url
  }));
  return {
    folderCount: parsed.folders.length,
    urlBookmarkCount: parsed.bookmarks.length,
    sampleBookmarks
  };
}

/** 读取并解析指定 Bookmarks 文件（用于测试页手动刷新单一路径） */
export async function previewLocalBookmarksFile(bookmarksFilePath: string): Promise<LocalBookmarksPreview> {
  if (!existsSync(bookmarksFilePath)) {
    return {
      ok: false,
      bookmarksFilePath,
      folderCount: 0,
      urlBookmarkCount: 0,
      sampleBookmarks: [],
      error: "文件不存在"
    };
  }
  try {
    const parsed = await parseBookmarksAtPath(bookmarksFilePath);
    return {
      ok: true,
      bookmarksFilePath,
      ...parsed
    };
  } catch (e) {
    return {
      ok: false,
      bookmarksFilePath,
      folderCount: 0,
      urlBookmarkCount: 0,
      sampleBookmarks: [],
      error: e instanceof Error ? e.message : String(e)
    };
  }
}

/** 读取所有可访问的 Chromium 系 Bookmarks 原始 JSON（用于规范化入库） */
export async function loadAllChromiumRawBookmarkFiles(): Promise<
  Array<{
    browserKey: string;
    browserLabel: string;
    profileName: string;
    bookmarksFilePath: string;
    raw: unknown;
  }>
> {
  const out: Array<{
    browserKey: string;
    browserLabel: string;
    profileName: string;
    bookmarksFilePath: string;
    raw: unknown;
  }> = [];

  for (const browser of CHROMIUM_BROWSERS) {
    const userDataDir = resolveUserDataRoot(browser.paths);
    if (!userDataDir || !existsSync(userDataDir)) continue;

    let entries;
    try {
      entries = await readdir(userDataDir, { withFileTypes: true });
    } catch {
      continue;
    }

    for (const ent of entries) {
      if (!ent.isDirectory()) continue;
      const profileName = ent.name;
      if (profileName === "SingletonSocket" || profileName === "segmentation_platform") continue;

      const bookmarksFilePath = join(userDataDir, profileName, "Bookmarks");
      if (!existsSync(bookmarksFilePath)) continue;

      try {
        const raw = JSON.parse(await readFile(bookmarksFilePath, "utf8")) as unknown;
        out.push({
          browserKey: browser.key,
          browserLabel: browser.label,
          profileName,
          bookmarksFilePath,
          raw
        });
      } catch {
        // 跳过损坏或正在写入的文件
      }
    }
  }

  out.sort((a, b) => {
    const c = a.browserLabel.localeCompare(b.browserLabel, "zh-Hans");
    if (c !== 0) return c;
    return a.profileName.localeCompare(b.profileName, "zh-Hans");
  });

  return out;
}

/** 枚举本机 Chromium 系配置目录下含 Bookmarks 的配置档并解析 */
export async function scanLocalChromiumBookmarkProfiles(): Promise<LocalChromiumBookmarkProfile[]> {
  const out: LocalChromiumBookmarkProfile[] = [];

  for (const browser of CHROMIUM_BROWSERS) {
    const userDataDir = resolveUserDataRoot(browser.paths);
    if (!userDataDir || !existsSync(userDataDir)) continue;

    let entries;
    try {
      entries = await readdir(userDataDir, { withFileTypes: true });
    } catch {
      continue;
    }

    for (const ent of entries) {
      if (!ent.isDirectory()) continue;
      const profileName = ent.name;
      if (profileName === "SingletonSocket" || profileName === "segmentation_platform") continue;

      const profileDir = join(userDataDir, profileName);
      const bookmarksFilePath = join(profileDir, "Bookmarks");
      if (!existsSync(bookmarksFilePath)) continue;

      const row: LocalChromiumBookmarkProfile = {
        browserKey: browser.key,
        browserLabel: browser.label,
        userDataDir,
        profileName,
        profileDir,
        bookmarksFilePath,
        fileExists: true
      };

      try {
        const parsed = await parseBookmarksAtPath(bookmarksFilePath);
        row.folderCount = parsed.folderCount;
        row.urlBookmarkCount = parsed.urlBookmarkCount;
        row.sampleBookmarks = parsed.sampleBookmarks.slice(0, 8);
      } catch (e) {
        row.error = e instanceof Error ? e.message : String(e);
      }

      out.push(row);
    }
  }

  out.sort((a, b) => {
    const c = a.browserLabel.localeCompare(b.browserLabel, "zh-Hans");
    if (c !== 0) return c;
    return a.profileName.localeCompare(b.profileName, "zh-Hans");
  });

  return out;
}
