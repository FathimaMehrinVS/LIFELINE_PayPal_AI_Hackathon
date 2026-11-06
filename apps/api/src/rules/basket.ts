import type { BasketItem, CommerceRequest, CommerceResult, NeedCategory } from "@lifeline/contracts";
import { roundMoney } from "../utils/money";
import type { ProductCandidate } from "../modules/commerce/product-source";

export type RankedProduct = { product_id: string; reason: string };
const cents = (amount: number) => Math.round((amount + Number.EPSILON) * 100);
const amount = (value: number) => roundMoney(value / 100);

export function buildBasket(request: CommerceRequest, products: ProductCandidate[], ranking: RankedProduct[] = []): CommerceResult {
  const reasons = new Map(ranking.filter((entry) => products.some((product) => product.id === entry.product_id)).map((entry) => [entry.product_id, entry.reason]));
  const order = new Map(ranking.map((entry, index) => [entry.product_id, index]));
  const budgetCents = cents(request.budget);
  const targetReserveCents = cents(request.budget * request.reserve_ratio);
  const spendLimit = Math.max(0, budgetCents - targetReserveCents);
  const selected: { product: ProductCandidate; reason: string }[] = [];
  let spent = 0;
  const unmet: NeedCategory[] = [];

  for (const need of [...new Set(request.needs)]) {
    const options = products.filter((product) => product.category === need && product.currency === request.currency && product.availability !== "unavailable")
      .sort((a, b) => (order.get(a.id) ?? Number.MAX_SAFE_INTEGER) - (order.get(b.id) ?? Number.MAX_SAFE_INTEGER) || cents(a.price) - cents(b.price) || a.id.localeCompare(b.id));
    const choice = options.find((product) => spent + cents(product.price) <= spendLimit);
    if (!choice) { unmet.push(need); continue; }
    spent += cents(choice.price);
    selected.push({ product: choice, reason: reasons.get(choice.id) ?? `${choice.name} directly addresses the ${need.replace("_", " ")} need.` });
  }

  const toItem = (product: ProductCandidate): BasketItem => ({
    product_id: product.id, name: product.name, category: product.category, merchant_id: product.merchantId, merchant_name: product.merchantName,
    source: product.source, availability: product.availability, quantity: 1, unit_price: roundMoney(product.price), subtotal: roundMoney(product.price),
    price_label: product.source === "local_registry" ? "illustrative" : "estimate", ...(product.purchaseUrl ? { purchase_url: product.purchaseUrl } : {}),
  });
  const chosenIds = new Set(selected.map(({ product }) => product.id));
  const alternatives = request.needs.flatMap((need) => products.filter((product) => product.category === need && !chosenIds.has(product.id) && product.currency === request.currency && product.availability !== "unavailable")
    .sort((a, b) => cents(a.price) - cents(b.price) || a.id.localeCompare(b.id)).slice(0, 2).map(toItem));
  const explanations = selected.map(({ product, reason }) => `${product.name}: ${reason}`);
  return {
    items: selected.map(({ product }) => toItem(product)), alternatives, total: amount(spent), reserve: amount(budgetCents - spent), currency: request.currency,
    unmet_needs: unmet,
    explanation: `${explanations.length ? explanations.join(" ") : "No requested need could be covered within budget."} ${unmet.length ? `Still unmet: ${unmet.join(", ")}.` : "All requested categories received an item."} Prices and totals are calculated from catalogue data; local registry prices are illustrative.`,
  };
}
