import { defineRpc } from "@getpaseo/plugin";
import { z } from "zod";

export const engines = ["claude", "codex", "opencode", "pi", "omp"] as const;
export const protocolSchema = z.enum(["anthropic", "responses", "chat-completions"]);
export const supplierSchema = z.object({
  id: z.string().regex(/^[a-z][a-z0-9-]{0,39}$/),
  name: z.string().trim().min(1).max(100),
  protocol: protocolSchema,
  anthropicAuth: z.enum(["api-key", "bearer"]).default("api-key"),
  baseUrl: z.string().url().max(2048).refine(value => {
    const url = new URL(value);
    return ["http:", "https:"].includes(url.protocol) && !url.username && !url.password && !url.search && !url.hash;
  }, "地址仅支持 HTTP/HTTPS，不能包含密码、查询参数或片段"),
  models: z.array(z.string().trim().min(1).max(200).regex(/^[^\s]+$/)).min(1).max(100),
  agents: z.array(z.enum(engines)).min(1),
  contextWindow: z.number().int().min(1024).max(2000000).default(32768),
  maxTokens: z.number().int().min(32).max(200000).default(4096),
  enabled: z.boolean().default(true),
});
export type Supplier = z.infer<typeof supplierSchema>;
export type Engine = typeof engines[number];
export const publicSupplierSchema = supplierSchema.extend({ hasKey: z.boolean() });
export type PublicSupplier = z.infer<typeof publicSupplierSchema>;
export const saveRpc = defineRpc({ name: "suppliers.save", input: supplierSchema.extend({ key: z.string().max(8192).optional(), revision: z.string() }), output: z.object({ supplier: publicSupplierSchema }) });
export const stateRpc = defineRpc({ name: "suppliers.state", input: z.object({}), output: z.object({ suppliers: z.array(publicSupplierSchema), revision: z.string() }) });
export const probeRpc = defineRpc({ name: "suppliers.probe", input: z.object({ id: z.string(), model: z.string() }), output: z.object({ ok: z.boolean(), message: z.string() }) });
export function compatible(protocol: Supplier["protocol"], engine: Engine): boolean {
  return engine === "claude" ? protocol === "anthropic" : engine === "codex" ? protocol === "responses" : engine === "opencode" ? protocol !== "responses" : true;
}
export function aliasId(id: string, engine: Engine): string { return `mp-${id}-${engine}`; }
export function modelId(supplier: Supplier, engine: Engine, model: string): string {
  return engine === "pi" || engine === "omp" || engine === "opencode" ? `${aliasId(supplier.id, engine)}/${model}` : model;
}
export const discoverRpc = defineRpc({
  name: "suppliers.models",
  input: supplierSchema.pick({ baseUrl: true, protocol: true, anthropicAuth: true }).extend({ id: supplierSchema.shape.id.optional(), key: z.string().max(8192).optional() }),
  output: z.object({ ok: z.boolean(), message: z.string(), models: z.array(z.object({ id: z.string(), name: z.string() })) }),
});
