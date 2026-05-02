import { mkdir, readFile, unlink } from "node:fs/promises";
import { dirname, join } from "node:path";
import { DEFAULT_MODEL_ROUTES, PROVIDER_TEMPLATES } from "@beelite/llm-engine";
import type {
  LlmProviderCredentialState,
  LlmSetProviderPayload,
  LlmSettingsPublic,
  ModelRoute,
  ProviderKind
} from "@beelite/shared";
import type { KnowledgeRepository } from "@beelite/storage-engine";
import { createNodeSqliteRepository } from "@beelite/storage-engine/node";

interface LegacyFileShape {
  version: 1;
  providers: Partial<
    Record<
      string,
      {
        apiKeyEnc?: string;
        baseUrl?: string;
        model?: string;
      }
    >
  >;
}

function resolveRoutes(
  providers: Partial<
    Record<
      string,
      {
        baseUrl?: string;
        model?: string;
      }
    >
  >
): ModelRoute[] {
  return DEFAULT_MODEL_ROUTES.map((route) => {
    const row = providers[route.providerId];
    return {
      ...route,
      model: row?.model?.trim() ? row.model : route.model
    };
  });
}

export class LlmSettingsStore {
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

  /**
   * 自 `llm-settings.json` 迁入 SQLite：仅迁移 baseUrl / model（旧 apiKeyEnc 无法在无 OS 密钥链时解密，需重新填写）。
   */
  private async migrateLegacyJsonOnce(): Promise<void> {
    if (this.migrationDone) return;
    try {
      let raw: string;
      try {
        raw = await readFile(this.legacyJsonPath, "utf8");
      } catch {
        return;
      }

      let parsed: LegacyFileShape;
      try {
        parsed = JSON.parse(raw) as LegacyFileShape;
        if (parsed.version !== 1 || typeof parsed.providers !== "object" || parsed.providers === null) {
          return;
        }
      } catch {
        return;
      }

      for (const [id, row] of Object.entries(parsed.providers)) {
        if (!row) continue;
        const patch: { apiKey?: string | null; baseUrl?: string | null; model?: string | null } = {};
        if (row.baseUrl !== undefined) {
          patch.baseUrl = row.baseUrl?.trim() ? row.baseUrl.trim() : null;
        }
        if (row.model !== undefined) {
          patch.model = row.model?.trim() ? row.model.trim() : null;
        }
        if (Object.keys(patch).length === 0) continue;
        this.repository.saveLlmProvider(id, patch);
      }

      try {
        await unlink(this.legacyJsonPath);
      } catch {
        /* 忽略删除失败 */
      }
    } finally {
      this.migrationDone = true;
    }
  }

  private providersFromRepo(): Partial<
    Record<
      string,
      {
        apiKey?: string;
        baseUrl?: string;
        model?: string;
      }
    >
  > {
    const out: Partial<
      Record<string, { apiKey?: string; baseUrl?: string; model?: string }>
    > = {};
    for (const row of this.repository.listLlmProviderSettings()) {
      const entry: { apiKey?: string; baseUrl?: string; model?: string } = {};
      if (row.apiKey && row.apiKey.length > 0) entry.apiKey = row.apiKey;
      if (row.baseUrl && row.baseUrl.length > 0) entry.baseUrl = row.baseUrl;
      if (row.model && row.model.length > 0) entry.model = row.model;
      if (Object.keys(entry).length > 0) out[row.providerId] = entry;
    }
    return out;
  }

  async getPublic(): Promise<LlmSettingsPublic> {
    await this.migrateLegacyJsonOnce();
    const providersMap = this.providersFromRepo();

    const providers: LlmProviderCredentialState[] = PROVIDER_TEMPLATES.map((template) => {
      const row = providersMap[template.id];
      return {
        providerId: template.id,
        hasApiKey: Boolean(row?.apiKey && row.apiKey.length > 0),
        baseUrl: row?.baseUrl?.trim() || undefined,
        model: row?.model?.trim() || undefined
      };
    });

    return {
      providers,
      routes: resolveRoutes(providersMap)
    };
  }

  async setProvider(payload: LlmSetProviderPayload): Promise<LlmSettingsPublic> {
    await this.migrateLegacyJsonOnce();
    const id = payload.providerId as string;
    const patch: { apiKey?: string | null; baseUrl?: string | null; model?: string | null } = {};

    if (payload.apiKey === null) {
      patch.apiKey = null;
    } else if (payload.apiKey !== undefined && payload.apiKey.trim().length > 0) {
      patch.apiKey = payload.apiKey.trim();
    }

    if (payload.baseUrl !== undefined) {
      const trimmed = payload.baseUrl?.trim();
      patch.baseUrl = trimmed && trimmed.length > 0 ? trimmed : null;
    }

    if (payload.model !== undefined) {
      const trimmed = payload.model?.trim();
      patch.model = trimmed && trimmed.length > 0 ? trimmed : null;
    }

    if (Object.keys(patch).length > 0) {
      this.repository.saveLlmProvider(id, patch);
    }

    return this.getPublic();
  }

  async getDecryptedApiKey(providerId: ProviderKind): Promise<string | undefined> {
    await this.migrateLegacyJsonOnce();
    const rows = this.repository.listLlmProviderSettings();
    const hit = rows.find((r) => r.providerId === (providerId as string));
    const key = hit?.apiKey?.trim();
    return key && key.length > 0 ? key : undefined;
  }
}

export async function createLlmSettingsStore(
  userDataPath: string,
  sharedRepository?: KnowledgeRepository | undefined
): Promise<LlmSettingsStore> {
  const legacyJsonPath = join(userDataPath, "llm-settings.json");

  if (sharedRepository) {
    return new LlmSettingsStore(legacyJsonPath, sharedRepository, false);
  }

  const dbPath = join(userDataPath, "beelite.sqlite");
  await mkdir(dirname(dbPath), { recursive: true });
  const repo = await createNodeSqliteRepository(dbPath);
  repo.initialize();
  return new LlmSettingsStore(legacyJsonPath, repo, true);
}
