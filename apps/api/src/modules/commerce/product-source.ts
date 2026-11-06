import type { Availability, CommerceRequest, NeedCategory } from "@lifeline/contracts";
import { env } from "../../config/env";
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

function validCategory(value: unknown): value is NeedCategory {
  return typeof value === "string" && ["food", "water", "medicine", "shelter", "hygiene", "baby_supplies", "clothing", "transport", "other"].includes(value);
}

export class Channel3Source implements ProductSource {
  constructor(private readonly apiKey = env.CHANNEL3_API_KEY, private readonly fetchImpl: typeof fetch = fetch) {}
  async search(request: CommerceRequest): Promise<ProductCandidate[]> {
    if (!this.apiKey) return [];
    try {
      const response = await this.fetchImpl("https://api.trychannel3.com/v1/search", {
        method: "POST", headers: { "x-api-key": this.apiKey, "Content-Type": "application/json" },
        body: JSON.stringify({ query: `affordable emergency essentials ${request.needs.join(" ")} near ${request.location}`, limit: 20, config: { currency: request.currency } }),
        signal: AbortSignal.timeout(8_000),
      });
      if (!response.ok) return [];
      const body = await response.json() as { data?: unknown[] };
      return (body.data ?? []).flatMap((raw): ProductCandidate[] => {
        if (!raw || typeof raw !== "object") return [];
        const item = raw as { id?: unknown; title?: unknown; description?: unknown; category?: unknown; offers?: unknown[]; url?: unknown };
        const offer = item.offers?.find((value) => value && typeof value === "object") as { price?: { price?: unknown; amount?: unknown; currency?: unknown; currency_code?: unknown }; url?: unknown; merchant?: { name?: unknown; domain?: unknown }; domain?: unknown } | undefined;
        const price = Number(offer?.price?.price ?? offer?.price?.amount);
        const currency = String(offer?.price?.currency_code ?? offer?.price?.currency ?? request.currency);
        const productText = `${item.category ?? ""} ${item.title ?? ""} ${item.description ?? ""}`.toLowerCase().replaceAll("_", " ");
        const aliases: Record<NeedCategory, string[]> = { food: ["food", "grocery", "rice", "meal", "lentil", "oat"], water: ["water", "filter", "purif"], medicine: ["medicine", "medical", "health", "first aid"], shelter: ["shelter", "tarp", "tent"], hygiene: ["hygiene", "soap", "sanitary", "toothbrush"], baby_supplies: ["baby", "infant", "diaper", "nappy"], clothing: ["clothing", "apparel", "sock", "blanket", "coat"], transport: ["transport", "transit", "bus"], other: ["household", "battery", "flashlight"] };
        const category = validCategory(item.category) ? item.category : request.needs.find((need) => aliases[need].some((alias) => productText.includes(alias)));
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
          category, price, currency, merchantId: `channel3:${String(offer?.merchant?.domain ?? offer?.domain ?? "unknown")}`, merchantName: String(offer?.merchant?.name ?? offer?.merchant?.domain ?? offer?.domain ?? "Online retailer"), source: "channel3", availability: "unknown", ...(url ? { purchaseUrl: url } : {}) }];
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
