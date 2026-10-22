import type { Supplier } from "./contracts";

// Official defaults checked 2026-10-22: https://api-docs.deepseek.com/api/list-models/
export const supplierPresets: Record<string, Supplier> = {
  deepseek: {
    id: "deepseek", name: "DeepSeek", protocol: "chat-completions", anthropicAuth: "api-key",
    baseUrl: "https://api.deepseek.com/v1", models: ["deepseek-flash", "deepseek-v4-pro"],
    agents: ["opencode", "pi", "omp"], contextWindow: 1048576, maxTokens: 393216, enabled: true,
  },
};
