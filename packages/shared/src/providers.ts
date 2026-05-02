export type ProviderKind =
  | "openai"
  | "anthropic"
  | "google"
  | "deepseek"
  | "qwen"
  | "kimi"
  | "openrouter"
  | "ollama"
  | "openai-compatible";

export interface ProviderTemplate {
  id: ProviderKind;
  label: string;
  defaultBaseUrl?: string;
  defaultModels: string[];
  supportsLocal: boolean;
  supportsCustomBaseUrl: boolean;
  notes: string;
}

export interface ModelRoute {
  task:
    | "reasoning"
    | "structured_output"
    | "long_context"
    | "local_private"
    | "research"
    | "embedding";
  providerId: ProviderKind;
  model: string;
}

export interface LlmRuntimeConfig {
  providerId: ProviderKind;
  model: string;
  baseUrl?: string;
  apiKeyStorageRef?: string;
  contextWindow?: number;
  maxOutputTokens?: number;
  reasoningEnabled?: boolean;
}
