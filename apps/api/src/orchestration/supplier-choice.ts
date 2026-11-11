import type { NeedCategory } from "@lifeline/contracts";

// Owner: Member 1. A plan has one purchase order, so its basket comes from one approved supplier: the one that
// covers the most of the family's needs. Needs it can't cover stay listed as unmet instead of being bought elsewhere.

type Product = { merchantId: string; category: string };

export function singleSupplierProducts<T extends Product>(products: readonly T[], needs: readonly NeedCategory[], approved: ReadonlySet<string>): T[] {
  const eligible = products.filter((product) => approved.has(product.merchantId) && needs.includes(product.category as NeedCategory));
  const bySupplier = new Map<string, T[]>();
  for (const product of eligible) bySupplier.set(product.merchantId, [...(bySupplier.get(product.merchantId) ?? []), product]);
  let best: T[] = [];
  let bestNeeds = 0;
  for (const supplierProducts of [...bySupplier.values()].sort((a, b) => a[0]!.merchantId.localeCompare(b[0]!.merchantId))) {
    const covered = new Set(supplierProducts.map((product) => product.category)).size;
    if (covered > bestNeeds || (covered === bestNeeds && supplierProducts.length > best.length)) {
      best = supplierProducts;
      bestNeeds = covered;
    }
  }
  return best;
}
