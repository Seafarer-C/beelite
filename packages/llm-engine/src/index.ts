import type { LlmRuntimeConfig, ModelRoute, ProviderTemplate } from "@beelite/shared";

export const PROVIDER_TEMPLATES: ProviderTemplate[] = [
  {
    id: "openai",
    label: "OpenAI",
    defaultModels: ["gpt-5.1", "gpt-4.1"],
    supportsLocal: false,
    supportsCustomBaseUrl: false,
    notes: "适合结构化输出、推理和通用任务。"
  },
  {
    id: "anthropic",
    label: "Anthropic Claude",
    defaultModels: ["claude-sonnet-4.5", "claude-opus-4.1"],
    supportsLocal: false,
    supportsCustomBaseUrl: false,
    notes: "适合长文本分析与研究综合。"
  },
  {
    id: "google",
    label: "Google Gemini",
    defaultModels: ["gemini-2.5-pro", "gemini-2.5-flash"],
    supportsLocal: false,
    supportsCustomBaseUrl: false,
    notes: "适合长上下文和多模态任务。"
  },
  {
    id: "deepseek",
    label: "DeepSeek",
    defaultBaseUrl: "https://api.deepseek.com",
    defaultModels: ["deepseek-chat", "deepseek-reasoner"],
    supportsLocal: false,
    supportsCustomBaseUrl: true,
    notes: "中国模型快捷模板，走 OpenAI-compatible 接口。"
  },
  {
    id: "qwen",
    label: "Qwen",
    defaultBaseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1",
    defaultModels: ["qwen-plus", "qwen-max", "qwen3-coder-plus"],
    supportsLocal: false,
    supportsCustomBaseUrl: true,
    notes: "通义千问快捷模板，可替换为 Ollama 本地模型。"
  },
  {
    id: "kimi",
    label: "Kimi",
    defaultBaseUrl: "https://api.moonshot.cn/v1",
    defaultModels: ["kimi-k2-0711-preview", "moonshot-v1-128k"],
    supportsLocal: false,
    supportsCustomBaseUrl: true,
    notes: "适合中文长上下文与代码任务。"
  },
  {
    id: "openrouter",
    label: "OpenRouter",
    defaultBaseUrl: "https://openrouter.ai/api/v1",
    defaultModels: ["openrouter/auto", "anthropic/claude-sonnet-4"],
    supportsLocal: false,
    supportsCustomBaseUrl: true,
    notes: "用于快速试验多模型路由。"
  },
  {
    id: "openai-compatible",
    label: "OpenAI 兼容",
    defaultBaseUrl: "",
    defaultModels: ["gpt-4o-mini", "text-embedding-3-large"],
    supportsLocal: false,
    supportsCustomBaseUrl: true,
    notes: "自建网关或其它兼容 OpenAI Chat Completions 的服务。"
  },
  {
    id: "ollama",
    label: "Ollama",
    defaultBaseUrl: "http://localhost:11434",
    defaultModels: ["qwen2.5:7b", "llama3.1:8b"],
    supportsLocal: true,
    supportsCustomBaseUrl: true,
    notes: "本地隐私任务优先使用。"
  }
];

export const DEFAULT_MODEL_ROUTES: ModelRoute[] = [
  { task: "reasoning", providerId: "deepseek", model: "deepseek-reasoner" },
  { task: "structured_output", providerId: "openai", model: "gpt-5.1" },
  { task: "long_context", providerId: "kimi", model: "moonshot-v1-128k" },
  { task: "local_private", providerId: "ollama", model: "qwen2.5:7b" },
  { task: "research", providerId: "anthropic", model: "claude-sonnet-4.5" },
  { task: "embedding", providerId: "openai-compatible", model: "text-embedding-3-large" }
];

export interface PiMonoRuntime {
  ai: unknown;
  agentCore: unknown;
}

export async function loadPiMonoRuntime(): Promise<PiMonoRuntime> {
  const [ai, agentCore] = await Promise.all([
    import("@mariozechner/pi-ai"),
    import("@mariozechner/pi-agent-core")
  ]);

  return { ai, agentCore };
}

export function createRuntimeConfig(
  providerId: LlmRuntimeConfig["providerId"],
  model?: string
): LlmRuntimeConfig {
  const template = PROVIDER_TEMPLATES.find((provider) => provider.id === providerId);

  return {
    providerId,
    model: model ?? template?.defaultModels[0] ?? "",
    baseUrl: template?.defaultBaseUrl,
    contextWindow: 128000,
    maxOutputTokens: 4096,
    reasoningEnabled: providerId === "deepseek" || providerId === "openai"
  };
}
