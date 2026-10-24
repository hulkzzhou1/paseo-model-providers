import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { promisify } from "node:util";
import { limitsForModel, requestModelId, type Supplier } from "../shared/contracts";

const exec = promisify(execFile);
type NativeModel = { slug: string; priority: number; [key: string]: unknown };
export function codexCatalog(supplier: Supplier, bundled: { models: NativeModel[] }) {
  if (!bundled.models?.length) throw new Error("Codex 内置模型目录为空，请更新 Codex CLI 后重试");
  const fallback = bundled.models.reduce((left, right) => left.priority < right.priority ? left : right);
  return { models: supplier.models.map(model => {
    const id = requestModelId(supplier, model);
    const template = bundled.models.find(item => item.slug === id) ?? fallback;
    const { contextWindow } = limitsForModel(supplier, model);
    // Keep the installed CLI's instructions and tools; only replace model identity and capacity.
    return { ...template, slug: id, display_name: model, context_window: contextWindow, max_context_window: contextWindow, auto_compact_token_limit: null };
  }) };
}
export async function writeCodexCatalog(supplier: Supplier, extensionPath: string) {
  let catalog: ReturnType<typeof codexCatalog>;
  try {
    const { stdout } = await exec("codex", ["debug", "models", "--bundled"], { timeout: 10000, maxBuffer: 8 * 1024 * 1024 });
    catalog = codexCatalog(supplier, JSON.parse(stdout));
  } catch { throw new Error("无法读取 Codex 内置模型目录，请更新 Codex CLI 后重试"); }
  const content = JSON.stringify(catalog);
  // Immutable files keep failed saves and existing sessions on their original catalog.
  const hash = createHash("sha256").update(content).digest("hex");
  const path = join(dirname(extensionPath), `codex-${supplier.id}-${hash}.json`);
  await writeFile(path, content, { mode: 0o600 });
  return path;
}
