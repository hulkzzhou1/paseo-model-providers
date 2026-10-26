import type { PublicSupplier } from "../shared/contracts";

export type SupplierFilter = "all" | "enabled" | "disabled";

export function filterSuppliers(suppliers: readonly PublicSupplier[], query: string, filter: SupplierFilter): PublicSupplier[] {
  const search = query.trim().toLowerCase();
  return suppliers.filter(item => (filter === "all" || item.enabled === (filter === "enabled")) &&
    [item.name, item.id, item.baseUrl, ...item.models, ...Object.values(item.modelMappings ?? {}), ...item.agents].join(" ").toLowerCase().includes(search));
}
