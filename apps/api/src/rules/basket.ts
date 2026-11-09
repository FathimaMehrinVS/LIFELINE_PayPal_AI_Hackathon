import type { BasketItem, CommerceRequest, CommerceResult, NeedCategory } from "@lifeline/contracts";
import { roundMoney } from "../utils/money";
import type { ProductCandidate } from "../modules/commerce/product-source";

/** `suitable: false` means the AI judged it not to be an essential; the basket never uses it. */
export type RankedProduct = { product_id: string; reason: string; suitable?: boolean };

/** Online listings go first when usable; the synthetic local catalogue is the fallback. */
const SOURCE_ORDER: Record<ProductCandidate["source"], number> = { channel3: 0, local_registry: 1 };
/** Units for one week. Per-person items scale with the days covered; household items are bought once. */
const UNITS_PER_WEEK: Record<NeedCategory, { perPerson: number; perHousehold: number }> = {
  food: { perPerson: 2, perHousehold: 0 },
  water: { perPerson: 3, perHousehold: 0 },
  medicine: { perPerson: 0, perHousehold: 1 },
  shelter: { perPerson: 0, perHousehold: 1 },
  hygiene: { perPerson: 0, perHousehold: 1 },
  baby_supplies: { perPerson: 0, perHousehold: 2 },
  clothing: { perPerson: 1, perHousehold: 0 },
  transport: { perPerson: 1, perHousehold: 0 },
  other: { perPerson: 0, perHousehold: 1 },
};

/** Kits and reusable items already serve the whole household, so one is enough. */
const SINGLE_UNIT = /\b(kits?|bundles?|buckets?|supply|filters?|tablets|thermometers?)\b/i;

/** How many of a product the household needs. Without a household size, each item stays quantity 1. */
export function targetQuantity(need: NeedCategory, name: string, householdSize: number | undefined, days = 7): number {
  if (householdSize === undefined || SINGLE_UNIT.test(name)) return 1;
  const { perPerson, perHousehold } = UNITS_PER_WEEK[need];
  return Math.max(1, Math.ceil(perPerson ? perPerson * householdSize * (days / 7) : perHousehold));
}

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
  const uniqueNeeds = [...new Set(request.needs)];
  const selected: { product: ProductCandidate; reason: string; quantity: number }[] = [];
  let spent = 0;
  const unmet: NeedCategory[] = [];

  for (const [index, need] of uniqueNeeds.entries()) {
    // This need's fair share of what's left, so money it doesn't use passes to the needs after it.
    const allowance = Math.floor((spendLimit - spent) / (uniqueNeeds.length - index));
    const options = eligible.filter((product) => product.category === need && product.currency === request.currency && product.availability !== "unavailable")
      .sort((a, b) => sourceRank(a) - sourceRank(b) || (order.get(a.id) ?? Number.MAX_SAFE_INTEGER) - (order.get(b.id) ?? Number.MAX_SAFE_INTEGER) || cents(a.price) - cents(b.price) || a.id.localeCompare(b.id));
    const fits = (product: ProductCandidate) => spent + cents(product.price) <= spendLimit;
    // Prefer an item within this need's fair share, so one expensive product can't use up the money for the others.
    const choice = options.find((product) => fits(product) && cents(product.price) <= allowance) ?? options.find(fits);
    if (!choice) { unmet.push(need); continue; }
    const affordable = Math.floor(allowance / cents(choice.price));
    const quantity = Math.max(1, Math.min(targetQuantity(need, choice.name, request.household_size, request.days_of_cover), affordable));
    spent += cents(choice.price) * quantity;
    selected.push({ product: choice, quantity, reason: reasons.get(choice.id) ?? `${choice.name} directly addresses the ${need.replace("_", " ")} need.` });
  }

  const toItem = (product: ProductCandidate, quantity = 1): BasketItem => ({
    product_id: product.id, name: product.name, category: product.category, merchant_id: product.merchantId, merchant_name: product.merchantName,
    source: product.source, availability: product.availability, quantity, unit_price: roundMoney(product.price), subtotal: amount(cents(product.price) * quantity),
    price_label: product.source === "local_registry" ? "illustrative" : "estimate", ...(product.purchaseUrl ? { purchase_url: product.purchaseUrl } : {}),
  });
  const chosenIds = new Set(selected.map(({ product }) => product.id));
  const alternatives = request.needs.flatMap((need) => eligible.filter((product) => product.category === need && !chosenIds.has(product.id) && product.currency === request.currency && product.availability !== "unavailable")
    .sort((a, b) => cents(a.price) - cents(b.price) || a.id.localeCompare(b.id)).slice(0, 2).map((product) => toItem(product)));
  const explanations = selected.map(({ product, reason }) => `${product.name}: ${reason}`);
  return {
    items: selected.map(({ product, quantity }) => toItem(product, quantity)), alternatives, total: amount(spent), reserve: amount(budgetCents - spent), currency: request.currency,
    unmet_needs: unmet,
    explanation: `${explanations.length ? explanations.join(" ") : "No requested need could be covered within budget."} ${unmet.length ? `Still unmet: ${unmet.join(", ")}.` : "All requested categories received an item."} Prices and totals are calculated from catalogue data; local registry prices are illustrative.`,
  };
}
