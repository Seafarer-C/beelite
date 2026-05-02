import { mkdir, readFile, unlink } from "node:fs/promises";
import { dirname, join } from "node:path";
import type {
  ResearchFetchPageParams,
  ResearchFetchPageResult,
  ResearchSearchParams,
  ResearchSearchProviderKind,
  ResearchSearchResult,
  ResearchSetSettingsPayload,
  ResearchSettingsPublic
} from "@beelite/shared";
import type { KnowledgeRepository } from "@beelite/storage-engine";
import { fetchPageTextViaCdp, runBrowserSearch, runWebSearch } from "@beelite/research-engine";
import { createNodeSqliteRepository } from "@beelite/storage-engine/node";

interface LegacyResearchFileShape {
  version?: number;
  provider?: unknown;
  apiKeyEnc?: string;
}

function coerceProvider(value: unknown): ResearchSearchProviderKind {
  if (value === "brave" || value === "tavily" || value === "serper" || value === "browser") {
    return value;
  }
  return "brave";
}

export class ResearchSettingsStore {
  private migrationDone = false;

  constructor(
    private readonly legacyJsonPath: string,
    private readonly repository: KnowledgeRepository,
    private readonly ownsRepository: boolean
  ) {}

  close(): void {
    if (this.ownsRepository) {
      this.repository.close();
    }
  }

  /** 自 `research-settings.json` 迁入 SQLite（旧 apiKeyEnc 无法解密时需重新填写 Key） */
  private async migrateLegacyJsonOnce(): Promise<void> {
    if (this.migrationDone) return;
    try {
      if (this.repository.getResearchSearchSettings() !== null) {
        try {
          await unlink(this.legacyJsonPath);
        } catch {
          /* 无遗留文件 */
        }
        return;
      }

      let raw: string;
      try {
        raw = await readFile(this.legacyJsonPath, "utf8");
      } catch {
        return;
      }

      let parsed: LegacyResearchFileShape;
      try {
        parsed = JSON.parse(raw) as LegacyResearchFileShape;
      } catch {
        return;
      }

      const provider = coerceProvider(parsed.provider);
      this.repository.saveResearchSearchSettings({
        provider,
        apiKey: null
      });

      try {
        await unlink(this.legacyJsonPath);
      } catch {
        /* 忽略删除失败 */
      }
    } finally {
      this.migrationDone = true;
    }
  }

  private async snapshot(): Promise<{ provider: ResearchSearchProviderKind; apiKey: string | null }> {
    await this.migrateLegacyJsonOnce();
    const row = this.repository.getResearchSearchSettings();
    return {
      provider: coerceProvider(row?.provider ?? "brave"),
      apiKey: row?.apiKey && row.apiKey.length > 0 ? row.apiKey : null
    };
  }

  async getPublic(): Promise<ResearchSettingsPublic> {
    const { provider, apiKey } = await this.snapshot();
    const isBrowser = provider === "browser";
    return {
      provider,
      hasApiKey: isBrowser || Boolean(apiKey && apiKey.length > 0),
      needsSearchApiKey: !isBrowser
    };
  }

  async setSettings(payload: ResearchSetSettingsPayload): Promise<ResearchSettingsPublic> {
    await this.snapshot();
    const patch: { provider?: string | null; apiKey?: string | null } = {};
    if (payload.provider !== undefined) {
      patch.provider = payload.provider;
    }
    if (payload.apiKey === null) {
      patch.apiKey = null;
    } else if (payload.apiKey !== undefined && payload.apiKey.trim().length > 0) {
      patch.apiKey = payload.apiKey.trim();
    }
    if (Object.keys(patch).length > 0) {
      this.repository.saveResearchSearchSettings(patch);
    }
    return this.getPublic();
  }

  async search(params: ResearchSearchParams): Promise<ResearchSearchResult> {
    const query = params.query.trim();
    const count = params.count ?? 10;

    if (!query) {
      return { ok: false, query: "", results: [], error: "请输入搜索关键词" };
    }

    const { provider, apiKey } = await this.snapshot();

    if (provider === "browser") {
      try {
        const { hits, debugText, blockedReason } = await runBrowserSearch(query, count);
        if (blockedReason) {
          return {
            ok: false,
            query,
            provider,
            results: [],
            error: blockedReason,
            browserDebug: debugText
          };
        }
        return { ok: true, query, provider, results: hits, browserDebug: debugText };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return {
          ok: false,
          query,
          provider,
          results: [],
          error: message
        };
      }
    }

    if (!apiKey || apiKey.length === 0) {
      return {
        ok: false,
        query,
        provider,
        results: [],
        error: "请先在 Research 面板配置搜索 API Key（Brave / Tavily / Serper）"
      };
    }

    try {
      const results = await runWebSearch(provider, apiKey, query, count);
      return { ok: true, query, provider, results };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        ok: false,
        query,
        provider,
        results: [],
        error: message
      };
    }
  }

  async fetchPage(params: ResearchFetchPageParams): Promise<ResearchFetchPageResult> {
    const raw = params.url.trim();
    if (!raw) {
      return { ok: false, error: "请输入 URL" };
    }

    let href: string;
    try {
      const parsed = new URL(raw);
      if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
        return { ok: false, error: "仅支持 http(s) 链接" };
      }
      href = parsed.href;
    } catch {
      return { ok: false, error: "无效的 URL" };
    }

    try {
      const maxChars = params.maxChars;
      const { title, text, truncated } = await fetchPageTextViaCdp(href, maxChars);
      return { ok: true, url: href, title, text, truncated };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return { ok: false, url: href, error: message };
    }
  }

  async getDecryptedSearchApiKey(): Promise<{ provider: ResearchSearchProviderKind; apiKey: string } | null> {
    const { provider, apiKey } = await this.snapshot();
    if (!apiKey || apiKey.length === 0) return null;
    return { provider, apiKey };
  }
}

export async function createResearchSettingsStore(
  userDataPath: string,
  sharedRepository?: KnowledgeRepository | undefined
): Promise<ResearchSettingsStore> {
  const legacyJsonPath = join(userDataPath, "research-settings.json");

  if (sharedRepository) {
    return new ResearchSettingsStore(legacyJsonPath, sharedRepository, false);
  }

  const dbPath = join(userDataPath, "beelite.sqlite");
  await mkdir(dirname(dbPath), { recursive: true });
  const repo = await createNodeSqliteRepository(dbPath);
  repo.initialize();
  return new ResearchSettingsStore(legacyJsonPath, repo, true);
}
