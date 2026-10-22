import type { Supplier } from "../shared/contracts";
export function parseModels(body: unknown): { id: string; name: string }[] {
  if (!body || typeof body !== "object" || !Array.isArray((body as { data?: unknown }).data)) throw new Error("模型列表格式不支持");
  const rows = (body as { data: unknown[] }).data;
  const models = new Map<string, { id: string; name: string }>();
  for (const row of rows.slice(0, 5000)) {
    if (!row || typeof row !== "object") continue;
    const item = row as Record<string, unknown>;
    if (typeof item.id !== "string" || !item.id || item.id.length > 200 || /\s/.test(item.id)) continue;
    models.set(item.id, { id: item.id, name: typeof item.display_name === "string" ? item.display_name.slice(0, 200) : item.id });
  }
  return [...models.values()];
}
export async function discoverModels(s: Pick<Supplier, "baseUrl" | "protocol" | "anthropicAuth"> & { key: string }) {
  const root = s.baseUrl.replace(/\/+$/, "");
  const headers: Record<string, string> = {};
  if (s.protocol === "anthropic") {
    headers["anthropic-version"] = "2023-06-01";
    if (s.anthropicAuth === "bearer") headers.Authorization = `Bearer ${s.key}`;
    else headers["x-api-key"] = s.key;
  } else if (s.key) headers.Authorization = `Bearer ${s.key}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20000);
  const result: { id: string; name: string }[] = [];
  let after = "";
  try {
    for (let page = 0; page < 20; page++) {
      const query = s.protocol === "anthropic" ? `?limit=100${after ? `&after_id=${encodeURIComponent(after)}` : ""}` : "";
      const response = await fetch(`${root.endsWith('/v1') ? root : root + '/v1'}/models${query}`, { headers, redirect: "error", signal: controller.signal });
      if (!response.ok) return { ok: false, message: `无法获取模型（HTTP ${response.status}），可手动填写模型 ID。`, models: [] };
      const body = await response.json() as { has_more?: boolean; last_id?: string };
      result.push(...parseModels(body));
      if (!body.has_more) return { ok: true, message: result.length ? "列表由供应商返回，模型调用权限仍需连接测试确认。" : "供应商没有返回模型，可手动填写。", models: [...new Map(result.map(item => [item.id, item])).values()] };
      if (typeof body.last_id !== "string" || !body.last_id || body.last_id === after) throw new Error("模型分页异常");
      after = body.last_id;
    }
    throw new Error("模型列表超过读取上限");
  } catch { return { ok: false, message: "无法读取完整模型列表，请检查接口或手动填写模型 ID。", models: [] }; }
  finally { clearTimeout(timer); }
}
