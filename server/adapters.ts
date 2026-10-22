import type { Supplier, Engine } from "../shared/contracts";
import { aliasId, compatible, modelId } from "../shared/contracts";

export type StoredSupplier = Supplier & { key: string };
export function buildAlias(s: StoredSupplier, engine: Engine, extensionPath: string) {
  if (!compatible(s.protocol, engine)) throw new Error("Agent 与接口协议不兼容");
  const id = aliasId(s.id, engine);
  const baseUrl = s.baseUrl.replace(/\/+$/, "");
  let env: Record<string, string>;
  let command: string[] | undefined;
  if (engine === "claude") {
    env = { ANTHROPIC_BASE_URL: baseUrl, ANTHROPIC_AUTH_TOKEN: s.anthropicAuth === "bearer" ? s.key : "", ANTHROPIC_API_KEY: s.anthropicAuth === "bearer" ? "" : s.key, CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC: "1" };
  } else if (engine === "codex") {
    env = { OPENAI_BASE_URL: baseUrl, OPENAI_API_KEY: s.key };
  } else if (engine === "opencode") {
    const npm = s.protocol === "anthropic" ? "@ai-sdk/anthropic" : "@ai-sdk/openai-compatible";
    env = { OPENCODE_CONFIG_CONTENT: JSON.stringify({ provider: { [id]: { npm, name: s.name, options: { baseURL: baseUrl, apiKey: s.key, ...(s.protocol === "anthropic" && s.anthropicAuth === "bearer" ? { headers: { Authorization: `Bearer ${s.key}` } } : {}) }, models: Object.fromEntries(s.models.map(model => [model, { name: model }])) } } }) };
  } else {
    command = [engine, "--extension", extensionPath];
    env = { PASEO_MODEL_KEY: s.key, PASEO_MODEL_CONFIG: JSON.stringify({ id, baseUrl, anthropicAuth: s.anthropicAuth, api: s.protocol === "anthropic" ? "anthropic-messages" : s.protocol === "responses" ? "openai-responses" : "openai-completions", models: s.models, contextWindow: s.contextWindow, maxTokens: s.maxTokens }) };
  }
  return {
    extends: engine, label: `${s.name} · ${engine}`, enabled: s.enabled,
    description: "Managed by model-providers",
    env, ...(command ? { command } : {}),
    models: s.models.map((model, i) => ({ id: modelId(s, engine, model), label: model, isDefault: i === 0 })),
    ...(engine === "claude" ? { disallowedTools: ["WebSearch"] } : {}),
  };
}
