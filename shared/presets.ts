import type { Supplier } from "./contracts";

export const supplierPresets: Record<string, Supplier> = {
  // Official defaults checked 2026-10-22: https://api-docs.deepseek.com/api/list-models/
  deepseek: {
    id: "deepseek", name: "DeepSeek", protocol: "chat-completions", anthropicAuth: "api-key",
    baseUrl: "https://api.deepseek.com/v1", models: ["deepseek-flash", "deepseek-v4-pro"],
    agents: ["opencode", "pi", "omp"], contextWindow: 1048576, maxTokens: 393216, enabled: true,
  },
  // Load the live catalog for per-model limits: https://openrouter.ai/docs/quickstart
  openrouter: {
    id: "openrouter", name: "OpenRouter", protocol: "chat-completions", anthropicAuth: "api-key",
    baseUrl: "https://openrouter.ai/api/v1", models: [],
    agents: ["opencode", "pi", "omp"], contextWindow: 32768, maxTokens: 4096, enabled: true,
  },
};
