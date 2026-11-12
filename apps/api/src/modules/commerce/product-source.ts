import type { Availability, CommerceRequest, NeedCategory } from "@lifeline/contracts";
import { env } from "../../config/env";
import { TtlCache } from "../../utils/ttl-cache";
import registry from "./registry.json";

export type ProductCandidate = {
  id: string; name: string; description: string; category: NeedCategory; price: number; currency: string;
  merchantId: string; merchantName: string; source: "local_registry" | "channel3"; availability: Availability; purchaseUrl?: string;
};
export interface ProductSource { search(request: CommerceRequest): Promise<ProductCandidate[]> }

export class LocalRegistrySource implements ProductSource {
  async search(request: CommerceRequest) {
    return registry.filter((item) => item.currency === request.currency && item.availability !== "unavailable")
      .map((item) => ({ id: item.id, name: item.name, description: item.description, category: item.category as NeedCategory,
        price: item.price, currency: item.currency, merchantId: item.merchant_id, merchantName: item.merchant_name,
        source: "local_registry" as const, availability: item.availability as Availability }));
  }
}

function normalizeAvailability(value: unknown): Availability {
  if (typeof value !== "string") return "unknown";
  const normalized = value.toLowerCase().replace(/[\s_-]/g, "");
  if (normalized === "instock" || normalized === "available") return "available";
  if (normalized === "limited") return "limited";
  if (normalized === "outofstock" || normalized === "unavailable") return "unavailable";
  return "unknown";
}

/** Words that show a product meets a need. Whole words only: "water" alone would also match micellar water. */
const NEED_TERMS: Record<NeedCategory, string[]> = {
  food: ["food", "foods", "grocery", "groceries", "rice", "meal", "meals", "lentil", "lentils", "oat", "oats", "ration", "rations", "flour"],
  water: ["drinking water", "bottled water", "emergency water", "water filter", "water purifier", "water purification", "water tablets", "water ration", "water rations", "water container"],
  medicine: ["medicine", "medicines", "medical", "medication", "first aid", "bandage", "bandages", "rehydration", "antiseptic", "thermometer", "insulin", "paracetamol"],
  shelter: ["shelter", "shelters", "tarp", "tarpaulin", "tent", "tents", "sleeping bag"],
  hygiene: ["hygiene", "soap", "sanitary", "toothbrush", "toothpaste", "hand sanitizer"],
  baby_supplies: ["infant formula", "baby formula", "baby food", "baby wipes", "baby kit", "diaper", "diapers", "nappy", "nappies", "newborn"],
  clothing: ["clothing", "apparel", "sock", "socks", "blanket", "blankets", "coat", "coats", "jacket", "poncho"],
  transport: ["transport", "transit", "bus ticket"],
  other: ["household", "battery", "batteries", "flashlight", "torch"],
};

/** Products that are never emergency essentials, even when their name contains a need word. */
const EXCLUDED_TERMS = [
  "book", "books", "handbook", "guide", "guidebook", "novel", "magazine",
  "cosmetic", "cosmetics", "skincare", "skin care", "serum", "micellar", "cleansing", "makeup", "moisturizer", "moisturiser", "toner", "fragrance", "perfume", "food mask", "sheet mask",
  "toy", "toys", "plush", "watering can",
  "food storage", "storage container", "food container", "freezer bags",
  "hardness", "test strip",
  "pet", "pets", "dog", "dogs", "cat", "cats", "puppy", "kitten",
];

/** Channel3 category branches that hold no emergency essentials (e.g. Cosmetics > Skin Care > Masks). */
const EXCLUDED_CATEGORY_PATH = /(^|-)(cosmetics|skin-care|hair-care|makeup|fragrances?|kitchen-dining|kitchen-appliances|pet-supplies|pets|toys|books|media)($|-)/;

const normalizeText = (text: string) => ` ${text.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim()} `;
const hasTerm = (text: string, terms: string[]) => terms.some((term) => text.includes(` ${term} `));

/**
 * Decides which need an online product meets, or null if it isn't an essential. Uses the title and category only:
 * descriptions mention too much (a survival handbook's description is full of "food" and "water").
 */
export function classifyProduct(title: string, categoryText: string, categoryPath: string[], needs: readonly NeedCategory[]): NeedCategory | null {
  if (categoryPath.some((slug) => EXCLUDED_CATEGORY_PATH.test(slug))) return null;
  const text = normalizeText(`${title} ${categoryText}`);
  if (hasTerm(text, EXCLUDED_TERMS)) return null;
  return needs.find((need) => hasTerm(text, NEED_TERMS[need])) ?? null;
}

/** What to search for each need: specific products, because vague phrases return car kits and toys. */
const NEED_QUERIES: Record<NeedCategory, string> = {
  food: "emergency food rations non-perishable",
  water: "water purification tablets portable water filter",
  medicine: "first aid kit medical supplies bandages",
  shelter: "emergency tent tarpaulin shelter",
  hygiene: "family hygiene kit soap toothbrush",
  baby_supplies: "baby diapers infant formula",
  clothing: "emergency blanket warm socks",
  transport: "public transit bus ticket",
  other: "flashlight batteries household emergency",
};

type Channel3SearchResponse = { products?: unknown[] };

/** How long one Channel3 answer is reused. Products and prices change slowly; this saves quota and seconds. */
const CHANNEL3_CACHE_MS = 10 * 60_000;

export class Channel3Source implements ProductSource {
  /** Successful answers only, keyed by search and currency. A failed or empty call is retried next time. */
  private readonly answers = new TtlCache<string, unknown[]>(CHANNEL3_CACHE_MS, 200);
  /** Calls already on their way, so ten clicks at once make one request. */
  private readonly inFlight = new Map<string, Promise<unknown[] | null>>();

  constructor(private readonly apiKey = env.CHANNEL3_API_KEY, private readonly fetchImpl: typeof fetch = fetch) {}
  /** One search per need: a single combined search mostly returns whichever need ranks highest. */
  async search(request: CommerceRequest): Promise<ProductCandidate[]> {
    const apiKey = this.apiKey;
    if (!apiKey) return [];
    const results = await Promise.all([...new Set(request.needs)].map((need) => this.searchNeed(apiKey, request, need)));
    return [...new Map(results.flat().map((product) => [product.id, product])).values()];
  }

  /** Raw Channel3 products for one need, from the cache when possible. Null means the call failed. */
  private async fetchProducts(apiKey: string, need: NeedCategory, currency: string): Promise<unknown[] | null> {
    const key = `${need}|${currency}`;
    const cached = this.answers.get(key);
    if (cached) return cached;
    const pending = this.inFlight.get(key);
    if (pending) return pending;
    const call = (async () => {
      try {
        const response = await this.fetchImpl("https://api.trychannel3.com/v1/search", {
          method: "POST", headers: { "x-api-key": apiKey, "Content-Type": "application/json" },
          body: JSON.stringify({ query: NEED_QUERIES[need], limit: 10, config: { currency } }),
          signal: AbortSignal.timeout(8_000),
        });
        if (!response.ok) return null;
        const products = ((await response.json()) as Channel3SearchResponse).products ?? [];
        if (products.length > 0) this.answers.set(key, products);
        return products;
      } catch {
        return null;
      } finally {
        this.inFlight.delete(key);
      }
    })();
    this.inFlight.set(key, call);
    return call;
  }

  private async searchNeed(apiKey: string, request: CommerceRequest, need: NeedCategory): Promise<ProductCandidate[]> {
    try {
      const products = await this.fetchProducts(apiKey, need, request.currency);
      if (!products) return [];
      return products.flatMap((raw): ProductCandidate[] => {
        if (!raw || typeof raw !== "object") return [];
        const item = raw as { id?: unknown; title?: unknown; description?: unknown; category?: unknown; offers?: unknown[]; url?: unknown };
        const offer = item.offers?.find((value) => value && typeof value === "object") as { price?: { price?: unknown; amount?: unknown; currency?: unknown; currency_code?: unknown }; url?: unknown; availability?: unknown; merchant?: { name?: unknown; domain?: unknown }; domain?: unknown } | undefined;
        const price = Number(offer?.price?.price ?? offer?.price?.amount);
        const currency = String(offer?.price?.currency_code ?? offer?.price?.currency ?? request.currency);
        const categoryDetails = item.category && typeof item.category === "object" && !Array.isArray(item.category)
          ? item.category as { slug?: unknown; title?: unknown; path?: unknown }
          : undefined;
        const categoryText = [typeof item.category === "string" ? item.category : undefined, categoryDetails?.slug, categoryDetails?.title]
          .filter((value): value is string => typeof value === "string").join(" ");
        const categoryPath = [
          ...(Array.isArray(categoryDetails?.path) ? categoryDetails.path : []).map((entry) => String((entry as { slug?: unknown } | null)?.slug ?? "")),
          typeof categoryDetails?.slug === "string" ? categoryDetails.slug : "",
        ].filter(Boolean);
        const category = typeof item.title === "string" ? classifyProduct(item.title, categoryText, categoryPath, request.needs) : null;
        if (typeof item.id !== "string" || typeof item.title !== "string" || !Number.isFinite(price) || price <= 0 || currency !== request.currency || !category) return [];
        const rawUrl = typeof offer?.url === "string" ? offer.url : typeof item.url === "string" ? item.url : undefined;
        let url: string | undefined;
        if (rawUrl) {
          try {
            const parsedUrl = new URL(rawUrl);
            if (parsedUrl.protocol === "https:" || parsedUrl.protocol === "http:") url = parsedUrl.href;
          } catch { /* Ignore malformed purchase links while keeping the product candidate. */ }
        }
        return [{ id: `channel3:${item.id}`, name: item.title, description: typeof item.description === "string" ? item.description : "Product discovered through Channel3",
          category, price, currency, merchantId: `channel3:${String(offer?.merchant?.domain ?? offer?.domain ?? "unknown")}`, merchantName: String(offer?.merchant?.name ?? offer?.merchant?.domain ?? offer?.domain ?? "Online retailer"), source: "channel3", availability: normalizeAvailability(offer?.availability), ...(url ? { purchaseUrl: url } : {}) }];
      });
    } catch { return []; }
  }
}

export class CompositeProductSource implements ProductSource {
  constructor(private readonly sources: ProductSource[]) {}
  async search(request: CommerceRequest) {
    const results = await Promise.allSettled(this.sources.map((source) => source.search(request)));
    return results.flatMap((result) => result.status === "fulfilled" ? result.value : []);
  }
}

export const productSource: ProductSource = new CompositeProductSource([new LocalRegistrySource(), new Channel3Source()]);
