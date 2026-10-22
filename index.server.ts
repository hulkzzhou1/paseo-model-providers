import type { PluginServerContext } from "@getpaseo/plugin/server";
import { join } from "node:path";
import { writeFile, mkdir } from "node:fs/promises";
import agentExtension from "./server/agent-extension";
import { engines, aliasId, compatible, stateRpc, saveRpc, probeRpc, discoverRpc } from "./shared/contracts";
import { buildAlias } from "./server/adapters";
import { storeDir, readStore, writeStore } from "./server/store";
import { discoverModels } from "./server/models";
import { probe } from "./server/probe";

export default function contribute(server: PluginServerContext) {
  let pending: Promise<unknown> = Promise.resolve();
  const extensionPath = join(storeDir, "agent-extension.mjs");
  server.handle(stateRpc, async () => {
    const state = await readStore();
    return { revision: state.revision, suppliers: state.suppliers.map(({ key, ...supplier }) => ({ ...supplier, hasKey: Boolean(key) })) };
  });
  server.handle(saveRpc, (input, { paseo }) => {
    const task = pending.then(async () => {
      const state = await readStore();
      if (input.revision !== state.revision) throw new Error("配置已被其他窗口修改，请刷新后重试");
      if (input.maxTokens > input.contextWindow) throw new Error("最大输出不能超过上下文窗口");
      if (input.agents.some(engine => !compatible(input.protocol, engine))) throw new Error("所选 Agent 与协议不兼容");
      const { revision: _revision, key, ...supplier } = input;
      const previous = state.suppliers.find(item => item.id === input.id);
      const stored = { ...supplier, key: key || previous?.key || "" };
      await mkdir(storeDir, { recursive: true, mode: 0o700 });
      await writeFile(extensionPath, `export default ${agentExtension.toString()}\n`, { mode: 0o600 });
      const current = await paseo.config.get();
      const updates: Record<string, Record<string, unknown>> = {};
      for (const engine of engines) {
        const id = aliasId(stored.id, engine);
        const existing = current.config.providers[id];
        if (existing && existing.description !== "Managed by model-providers") throw new Error("该供应商标识与已有配置冲突，请使用其他标识");
        if (stored.agents.includes(engine)) updates[id] = buildAlias(stored, engine, extensionPath);
        else if (existing) updates[id] = { enabled: false };
      }
      const next = state.suppliers.filter(item => item.id !== stored.id).concat(stored);
      await writeStore(next);
      try { await paseo.config.patch({ providers: updates }); }
      catch { await writeStore(state.suppliers); throw new Error("Paseo 未接受供应商配置，已恢复原记录。请检查 Agent 是否已安装或配置是否有效"); }
      return { supplier: { ...supplier, hasKey: Boolean(stored.key) } };
    });
    pending = task.catch(() => {});
    return task;
  });
  server.handle(discoverRpc, async input => {
    const { suppliers } = await readStore();
    const previous = suppliers.find(item => item.id === input.id);
    return discoverModels({ ...input, key: input.key || previous?.key || "" });
  });
  server.handle(probeRpc, async ({ id, model }) => {
    const { suppliers } = await readStore();
    const supplier = suppliers.find(item => item.id === id);
    if (!supplier || !supplier.models.includes(model)) throw new Error("供应商或模型不存在，请刷新配置");
    return probe(supplier, model);
  });
  return () => {};
}
