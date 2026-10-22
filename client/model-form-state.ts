import type { CatalogModel, Supplier } from "../shared/contracts";
import { formatTokenCount } from "./token-limits";

export const maxModelRows = 100;
export type ModelRow = { key: number; id: string; apiId: string; contextWindow?: string; maxTokens?: string };

export function newModelRow(rows: readonly ModelRow[], id = "", limits?: Pick<CatalogModel, "contextWindow" | "maxTokens">): ModelRow {
  return { key: Math.max(-1, ...rows.map(row => row.key)) + 1, id, apiId: id,
    ...(limits?.contextWindow ? { contextWindow: formatTokenCount(limits.contextWindow) } : {}),
    ...(limits?.maxTokens ? { maxTokens: formatTokenCount(limits.maxTokens) } : {}) };
}

export function supplierModelRows(supplier: Supplier): ModelRow[] {
  return supplier.models.length ? supplier.models.map((id, key) => {
    const mapped = supplier.modelMappings?.[id];
    return { ...newModelRow([], id, supplier.modelLimits?.[id]), key, apiId: typeof mapped === "string" ? mapped : id };
  }) : [newModelRow([])];
}

export function mergeModelRows(current: readonly ModelRow[], models: readonly CatalogModel[]): { rows: ModelRow[]; omitted: number } {
  if (!models.length) return { rows: [...current], omitted: 0 };
  const rows = current.filter(row => row.id.trim() || row.apiId.trim() || row.contextWindow?.trim() || row.maxTokens?.trim());
  const known = new Set(rows.flatMap(row => [row.id.trim(), row.apiId.trim() || row.id.trim()]));
  let omitted = 0;
  for (const model of models) {
    if (known.has(model.id)) {
      const index = rows.findIndex(row => (row.apiId.trim() || row.id.trim()) === model.id);
      if (index >= 0) {
        const row = rows[index];
        rows[index] = { ...row,
          ...(!row.contextWindow?.trim() && model.contextWindow ? { contextWindow: formatTokenCount(model.contextWindow) } : {}),
          ...(!row.maxTokens?.trim() && model.maxTokens ? { maxTokens: formatTokenCount(model.maxTokens) } : {}) };
      }
      continue;
    }
    known.add(model.id);
    if (rows.length >= maxModelRows) { omitted++; continue; }
    rows.push(newModelRow(rows, model.id, model));
  }
  return { rows, omitted };
}
