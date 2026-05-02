<script setup lang="ts">
import { KeyRound, Settings2, Shield, X } from "lucide-vue-next";
import { computed, ref, watch } from "vue";
import { PROVIDER_TEMPLATES } from "@beelite/llm-engine";
import type { LlmProviderCredentialState, LlmSetProviderPayload, ProviderKind } from "@beelite/shared";
import { useWorkspaceStore } from "../stores/workspace";

const props = defineProps<{
  open: boolean;
}>();

const emit = defineEmits<{
  "update:open": [value: boolean];
}>();

const workspace = useWorkspaceStore();

const snapshot = ref<LlmProviderCredentialState[]>([]);
const selectedId = ref<ProviderKind>(PROVIDER_TEMPLATES[0]?.id ?? "openai");
const apiKeyInput = ref("");
const baseUrlInput = ref("");
const modelInput = ref("");
const saving = ref(false);
const message = ref<string | null>(null);

const messageIsError = computed(() => {
  if (!message.value) return false;
  return message.value !== "已保存" && message.value !== "已清除 API Key";
});

const selectedTemplate = computed(() => PROVIDER_TEMPLATES.find((p) => p.id === selectedId.value));

const credential = computed(() =>
  snapshot.value.find((row: LlmProviderCredentialState) => row.providerId === selectedId.value)
);

function isProviderConfigured(id: ProviderKind): boolean {
  return Boolean(snapshot.value.find((row: LlmProviderCredentialState) => row.providerId === id)?.hasApiKey);
}

function applyFormFromCredential(): void {
  const template = selectedTemplate.value;
  const cred = credential.value;
  apiKeyInput.value = "";
  baseUrlInput.value =
    cred?.baseUrl ?? template?.defaultBaseUrl ?? (template?.supportsCustomBaseUrl ? "" : "");
  modelInput.value = cred?.model ?? template?.defaultModels[0] ?? "";
}

async function loadSnapshot(): Promise<void> {
  if (!window.beelite?.getLlmSettings) return;
  const data = await window.beelite.getLlmSettings();
  if (!data) return;
  snapshot.value = data.providers;
  applyFormFromCredential();
}

watch(
  () => props.open,
  (visible) => {
    if (visible) {
      message.value = null;
      void loadSnapshot().then(() => applyFormFromCredential());
    }
  }
);

watch(selectedId, () => {
  applyFormFromCredential();
});

function close(): void {
  emit("update:open", false);
}

async function save(): Promise<void> {
  if (!window.beelite?.setLlmProvider) return;
  saving.value = true;
  message.value = null;
  try {
    const payload: LlmSetProviderPayload = {
      providerId: selectedId.value,
      baseUrl: baseUrlInput.value.trim() ? baseUrlInput.value.trim() : null,
      model: modelInput.value.trim() ? modelInput.value.trim() : null
    };
    if (apiKeyInput.value.trim().length > 0) {
      payload.apiKey = apiKeyInput.value.trim();
    }
    await window.beelite.setLlmProvider(payload);
    apiKeyInput.value = "";
    await loadSnapshot();
    await workspace.refreshLlmSettings();
    message.value = "已保存";
  } catch (error) {
    message.value = error instanceof Error ? error.message : String(error);
  } finally {
    saving.value = false;
  }
}

async function clearKey(): Promise<void> {
  if (!window.beelite?.setLlmProvider) return;
  saving.value = true;
  message.value = null;
  try {
    await window.beelite.setLlmProvider({
      providerId: selectedId.value,
      apiKey: null
    });
    apiKeyInput.value = "";
    await loadSnapshot();
    await workspace.refreshLlmSettings();
    message.value = "已清除 API Key";
  } catch (error) {
    message.value = error instanceof Error ? error.message : String(error);
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <Teleport to="body">
    <div v-if="open" class="model-settings-overlay" role="presentation" @click.self="close">
      <div
        class="model-settings-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="model-settings-title"
        @keydown.escape.prevent="close"
      >
        <header class="model-settings-head">
          <div class="model-settings-head-text">
            <Settings2 :size="19" />
            <div>
              <h2 id="model-settings-title">模型与 API</h2>
              <p>密钥保存在本机 SQLite；调用模型时将从此处读取。</p>
            </div>
          </div>
          <button type="button" class="model-settings-close" aria-label="关闭" @click="close">
            <X :size="18" />
          </button>
        </header>

        <p class="model-settings-warn">
          <Shield :size="15" />
          API Key 以明文保存在本机用户目录下的 <code>beelite.sqlite</code> 中，请勿备份或共享该文件。
        </p>

        <div class="model-settings-body">
          <nav class="model-settings-nav" aria-label="提供商">
            <button
              v-for="template in PROVIDER_TEMPLATES"
              :key="template.id"
              type="button"
              class="model-settings-nav-item"
              :class="{ active: template.id === selectedId }"
              @click="selectedId = template.id"
            >
              <span>{{ template.label }}</span>
              <small v-if="isProviderConfigured(template.id)">已配置</small>
            </button>
          </nav>

          <div v-if="selectedTemplate" class="model-settings-form">
            <p class="model-settings-notes">{{ selectedTemplate.notes }}</p>

            <label class="model-settings-field">
              <span>API Key</span>
              <div class="model-settings-key-row">
                <KeyRound :size="15" class="model-settings-key-icon" />
                <input
                  v-model="apiKeyInput"
                  type="password"
                  autocomplete="off"
                  :placeholder="
                    credential?.hasApiKey ? '留空保留已保存的密钥' : '粘贴 API Key（本地加密存储）'
                  "
                />
              </div>
            </label>

            <label v-if="selectedTemplate.supportsCustomBaseUrl" class="model-settings-field">
              <span>Base URL</span>
              <input v-model="baseUrlInput" type="url" placeholder="可选，留空则清除自定义地址" />
            </label>

            <label class="model-settings-field">
              <span>默认模型 ID</span>
              <input v-model="modelInput" type="text" list="model-preset-list" />
              <datalist id="model-preset-list">
                <option v-for="m in selectedTemplate.defaultModels" :key="m" :value="m" />
              </datalist>
              <small class="model-settings-hint">用于路由表中指向该提供商的任务；可与下拉预设一致或自定义。</small>
            </label>

            <div class="model-settings-actions">
              <button type="button" class="btn-secondary" :disabled="saving || !credential?.hasApiKey" @click="clearKey">
                清除密钥
              </button>
              <button type="button" class="btn-primary" :disabled="saving" @click="save">
                {{ saving ? "保存中…" : "保存" }}
              </button>
            </div>

            <p v-if="message" class="model-settings-message" :class="{ error: messageIsError }">
              {{ message }}
            </p>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>
