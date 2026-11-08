import type { BasketItem, CommerceRequest, CommerceResult, NeedCategory } from "@lifeline/contracts";
import { roundMoney } from "../utils/money";
import type { ProductCandidate } from "../modules/commerce/product-source";

/** `suitable: false` means the AI judged it not to be an essential; the basket never uses it. */
export type RankedProduct = { product_id: string; reason: string; suitable?: boolean };

/** Online listings go first when usable; the synthetic local catalogue is the fallback. */
const SOURCE_ORDER: Record<ProductCandidate["source"], number> = { channel3: 0, local_registry: 1 };
const cents = (amount: number) => Math.round((amount + Number.EPSILON) * 100);
const amount = (value: number) => roundMoney(value / 100);

export function buildBasket(request: CommerceRequest, products: ProductCandidate[], ranking: RankedProduct[] = []): CommerceResult {
  const reasons = new Map(ranking.filter((entry) => products.some((product) => product.id === entry.product_id)).map((entry) => [entry.product_id, entry.reason]));
  const order = new Map(ranking.map((entry, index) => [entry.product_id, index]));
  const vetted = new Set(ranking.filter((entry) => entry.suitable !== false).map((entry) => entry.product_id));
  const rejected = new Set(ranking.filter((entry) => entry.suitable === false).map((entry) => entry.product_id));
  // With an AI check, online listings must have passed it. If the AI is unavailable, keep the products that passed the
  // word and category filters, but use the local catalogue first.
  const aiChecked = ranking.length > 0;
  const eligible = products.filter((product) => !rejected.has(product.id) && (!aiChecked || product.source !== "channel3" || vetted.has(product.id)));
  const sourceRank = (product: ProductCandidate) => (aiChecked ? SOURCE_ORDER[product.source] : -SOURCE_ORDER[product.source]);
  const budgetCents = cents(request.budget);
  const targetReserveCents = cents(request.budget * request.reserve_ratio);
  const spendLimit = Math.max(0, budgetCents - targetReserveCents);
  const fairShare = Math.floor(spendLimit / Math.max(1, new Set(request.needs).size));
  const selected: { product: ProductCandidate; reason: string }[] = [];
  let spent = 0;
  const unmet: NeedCategory[] = [];

  for (const need of [...new Set(request.needs)]) {
    const options = eligible.filter((product) => product.category === need && product.currency === request.currency && product.availability !== "unavailable")
      .sort((a, b) => sourceRank(a) - sourceRank(b) || (order.get(a.id) ?? Number.MAX_SAFE_INTEGER) - (order.get(b.id) ?? Number.MAX_SAFE_INTEGER) || cents(a.price) - cents(b.price) || a.id.localeCompare(b.id));
    const fits = (product: ProductCandidate) => spent + cents(product.price) <= spendLimit;
    // Prefer an item within this need's fair share, so one expensive product can't use up the money for the others.
    const choice = options.find((product) => fits(product) && cents(product.price) <= fairShare) ?? options.find(fits);
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
  const alternatives = request.needs.flatMap((need) => eligible.filter((product) => product.category === need && !chosenIds.has(product.id) && product.currency === request.currency && product.availability !== "unavailable")
    .sort((a, b) => cents(a.price) - cents(b.price) || a.id.localeCompare(b.id)).slice(0, 2).map(toItem));
  const explanations = selected.map(({ product, reason }) => `${product.name}: ${reason}`);
  return {
    items: selected.map(({ product }) => toItem(product)), alternatives, total: amount(spent), reserve: amount(budgetCents - spent), currency: request.currency,
    unmet_needs: unmet,
    explanation: `${explanations.length ? explanations.join(" ") : "No requested need could be covered within budget."} ${unmet.length ? `Still unmet: ${unmet.join(", ")}.` : "All requested categories received an item."} Prices and totals are calculated from catalogue data; local registry prices are illustrative.`,
  };
}
