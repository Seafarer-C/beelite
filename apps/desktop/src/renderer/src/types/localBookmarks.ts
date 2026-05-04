/** 与主进程 `localBrowserBookmarks` 返回结构对齐 */
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
