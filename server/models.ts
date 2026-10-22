import { supplierSchema, type CatalogModel, type Supplier } from "../shared/contracts";
import { apiRoot } from "./endpoints";
function tokenLimit(...values: unknown[]): number | undefined {
  return values.find((value): value is number => typeof value === "number" && Number.isSafeInteger(value) && value > 0);
}
export function parseModels(body: unknown): CatalogModel[] {
  if (!body || typeof body !== "object") throw new Error("模型列表格式不支持");
  const payload = body as { data?: unknown };
  if (!Array.isArray(payload.data)) throw new Error("模型列表格式不支持");
  const rows: unknown[] = payload.data;
  const models = new Map<string, CatalogModel>();
  for (const row of rows.slice(0, 5000)) {
    if (!row || typeof row !== "object") continue;
    const item = row as Record<string, unknown>;
    if (typeof item.id !== "string" || !item.id || item.id.length > 200 || /\s/.test(item.id)) continue;
    const top = item.top_provider && typeof item.top_provider === "object" ? item.top_provider as Record<string, unknown> : undefined;
    const contextWindow = tokenLimit(item.context_window, item.max_input_tokens, item.maxInputTokens, top?.context_length, item.context_length);
    const maxTokens = tokenLimit(item.max_output_tokens, item.maxOutputTokens, item.max_tokens, top?.max_completion_tokens, item.max_completion_tokens);
    const name = typeof item.display_name === "string" ? item.display_name : typeof item.name === "string" ? item.name : item.id;
    models.set(item.id, { id: item.id, name: name.slice(0, 200), ...(contextWindow ? { contextWindow } : {}), ...(maxTokens ? { maxTokens } : {}) });
  }
  return [...models.values()];
}
export async function discoverModels(s: Pick<Supplier, "baseUrl" | "protocol" | "anthropicAuth"> & { key: string }) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20000);
  const result: CatalogModel[] = [];
  let after = "";
  try {
    const baseUrl = supplierSchema.shape.baseUrl.parse(s.baseUrl);
    const url = new URL(`${apiRoot(baseUrl)}/models`);
    const headers: Record<string, string> = {};
    if (s.protocol === "anthropic") headers["anthropic-version"] = "2023-06-01";
    if (s.key) {
      if (s.protocol === "anthropic" && s.anthropicAuth !== "bearer") headers["x-api-key"] = s.key;
      else headers.Authorization = `Bearer ${s.key}`;
    }
    if (s.protocol === "anthropic") url.searchParams.set("limit", "100");
    for (let page = 0; page < 20; page++) {
      if (after) url.searchParams.set("after_id", after);
      const response = await fetch(url.toString(), { headers, redirect: "error", signal: controller.signal });
      if (!response.ok) return { ok: false, message: `无法获取模型（HTTP ${response.status}），可手动填写模型 ID。`, models: [] };
      const body = await response.json() as { has_more?: boolean; last_id?: string };
      result.push(...parseModels(body));
      if (!body.has_more) return { ok: true, message: result.length ? "列表由供应商返回，不代表模型调用权限或推理兼容性已验证。" : "供应商没有返回可用目录项，可手动填写。", models: [...new Map(result.map(item => [item.id, item])).values()] };
      if (typeof body.last_id !== "string" || !body.last_id || body.last_id === after) throw new Error("模型分页异常");
      after = body.last_id;
    }
    throw new Error("模型列表超过读取上限");
  } catch { return { ok: false, message: "无法读取完整模型列表，请检查接口或手动填写模型 ID。", models: [] }; }
  finally { clearTimeout(timer); }
}
