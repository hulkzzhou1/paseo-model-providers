import type { StoredSupplier } from "./adapters";
import { apiRoot } from "./endpoints";
export function probeRequest(s: StoredSupplier, model: string) {
  const root = apiRoot(s.baseUrl);
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  const tool = { name: "probe", description: "Connectivity check. Return no tool calls.", input_schema: { type: "object", properties: {} } };
  if (s.protocol === "anthropic") {
    if (s.anthropicAuth === "bearer") headers.Authorization = `Bearer ${s.key}`;
    else headers["x-api-key"] = s.key;
    headers["anthropic-version"] = "2023-06-01";
    return { url: `${root}/messages`, headers, body: { model, max_tokens: 32, messages: [{ role: "user", content: "Reply OK." }], tools: [tool] } };
  }
  headers.Authorization = `Bearer ${s.key}`;
  return s.protocol === "responses"
    ? { url: `${root}/responses`, headers, body: { model, input: "Reply OK.", max_output_tokens: 64, tools: [{ type: "function", name: "probe", description: tool.description, parameters: tool.input_schema }] } }
    : { url: `${root}/chat/completions`, headers, body: { model, max_tokens: 32, messages: [{ role: "user", content: "Reply OK." }], tools: [{ type: "function", function: { name: "probe", description: tool.description, parameters: tool.input_schema } }] } };
}
export async function probe(s: StoredSupplier, model: string) {
  const request = probeRequest(s, model);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20000);
  try {
    const response = await fetch(request.url, { method: "POST", headers: request.headers, body: JSON.stringify(request.body), redirect: "error", signal: controller.signal });
    if (!response.ok) return { ok: false, message: `接口返回 HTTP ${response.status}，请检查地址、凭据和模型权限` };
    const body = await response.json() as Record<string, unknown>;
    const valid = s.protocol === "anthropic" ? Array.isArray(body.content) : s.protocol === "responses" ? Array.isArray(body.output) : Array.isArray(body.choices);
    return valid ? { ok: true, message: "模型响应与工具参数请求通过；尚未验证完整 Agent 工具执行链。" } : { ok: false, message: "返回结构不符合所选协议" };
  } catch { return { ok: false, message: "连接失败或超时，请检查网络、证书和服务地址" }; } finally { clearTimeout(timer); }
}
