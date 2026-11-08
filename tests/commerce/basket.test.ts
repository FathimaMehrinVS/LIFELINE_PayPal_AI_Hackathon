import { describe, expect, it, vi } from "vitest";
import type { CommerceRequest } from "@lifeline/contracts";
import { buildBasket, targetQuantity } from "../../apps/api/src/rules/basket";
import type { ProductCandidate } from "../../apps/api/src/modules/commerce/product-source";
import { rankProducts } from "../../apps/api/src/modules/commerce/service";

const request: CommerceRequest = { needs: ["food", "water"], budget: 10, currency: "EUR", location: "Demo", reserve_ratio: 0.2 };
const products: ProductCandidate[] = [
  { id: "rice", name: "Rice", description: "Staple", category: "food", price: 4.5, currency: "EUR", merchantId: "m1", merchantName: "Demo shop", source: "local_registry", availability: "available" },
  { id: "lentils", name: "Lentils", description: "Staple", category: "food", price: 3.2, currency: "EUR", merchantId: "m1", merchantName: "Demo shop", source: "local_registry", availability: "available" },
  { id: "water", name: "Water", description: "Drinking water", category: "water", price: 2.4, currency: "EUR", merchantId: "m1", merchantName: "Demo shop", source: "local_registry", availability: "available" },
];

describe("deterministic basket rules", () => {
  it("keeps spend under budget and calculates total and reserve in cents", () => {
    const result = buildBasket(request, products);
    expect(result.total).toBe(5.6); // lentils + water
    expect(result.reserve).toBe(4.4);
    expect(result.total + result.reserve).toBe(request.budget);
  });

  it("uses a cheaper substitute when the ranked first choice breaks the reserve target", () => {
    const result = buildBasket({ ...request, needs: ["food"], budget: 4 }, products, [{ product_id: "rice", reason: "Preferred staple" }, { product_id: "lentils", reason: "Lower-cost staple" }]);
    expect(result.items[0]?.product_id).toBe("lentils");
    expect(result.total).toBe(3.2);
    expect(result.reserve).toBe(0.8);
    expect(result.alternatives.some((item) => item.product_id === "rice")).toBe(true);
  });

  it("reports requested categories with no fitting product as unmet", () => {
    const result = buildBasket({ ...request, needs: ["transport"], budget: 10 }, products);
    expect(result.items).toHaveLength(0);
    expect(result.unmet_needs).toEqual(["transport"]);
  });

  it("never lists unavailable products as alternatives", () => {
    const unavailable = { ...products[0]!, id: "unavailable-rice", availability: "unavailable" as const };
    const result = buildBasket({ ...request, needs: ["food"] }, [...products, unavailable]);
    expect(result.alternatives.some((item) => item.product_id === "unavailable-rice")).toBe(false);
  });

  it("falls back deterministically when the ranking model fails", async () => {
    const ranker = vi.fn().mockRejectedValue(new Error("model offline"));
    const ranking = await rankProducts(request, products, ranker);
    const result = buildBasket(request, products, ranking);
    expect(ranking).toEqual([]);
    expect(result.items.map((item) => item.product_id)).toEqual(["lentils", "water"]);
  });

  describe("online products", () => {
    const online: ProductCandidate = { ...products[0]!, id: "c3-food", name: "Emergency rations", price: 3.9, source: "channel3" };

    it("prefers a checked online product over the local catalogue", () => {
      const result = buildBasket({ ...request, needs: ["food"] }, [...products, online], [{ product_id: "c3-food", reason: "Direct match" }]);
      expect(result.items[0]?.product_id).toBe("c3-food");
    });

    it("falls back to local when the online product doesn't fit the budget", () => {
      const pricey = { ...online, price: 500 };
      const result = buildBasket({ ...request, needs: ["food"] }, [...products, pricey], [{ product_id: "c3-food", reason: "Direct match" }]);
      expect(result.items[0]?.source).toBe("local_registry");
    });

    it("skips an online product the AI left out of its answer", () => {
      const result = buildBasket({ ...request, needs: ["food"] }, [...products, online], [{ product_id: "rice", reason: "Staple" }]);
      expect(result.items[0]?.source).toBe("local_registry");
      expect(result.alternatives.some((item) => item.product_id === "c3-food")).toBe(false);
    });

    it("uses the local catalogue first when the AI is unavailable", () => {
      const result = buildBasket({ ...request, needs: ["food"] }, [...products, online], []);
      expect(result.items[0]?.source).toBe("local_registry");
    });

    it("still builds a basket from filtered online products when the AI is unavailable and there is no local stock", () => {
      const result = buildBasket({ ...request, needs: ["food"] }, [online], []);
      expect(result.items[0]?.product_id).toBe("c3-food");
    });

    it("doesn't let one expensive item take another need's money while a cheaper one fits", () => {
      const needs: CommerceRequest["needs"] = ["food", "water"];
      const kit = { ...online, price: 7.5 };
      const result = buildBasket({ ...request, needs }, [...products, kit], [{ product_id: "c3-food", reason: "Direct match" }]);
      expect(result.items.map((item) => item.product_id)).toEqual(["lentils", "water"]);
    });

    it("never uses or suggests a product the AI marked unsuitable", () => {
      const result = buildBasket({ ...request, needs: ["food"] }, [...products, online], [{ product_id: "c3-food", reason: "A cosmetic", suitable: false }]);
      expect(result.items.some((item) => item.product_id === "c3-food")).toBe(false);
      expect(result.alternatives.some((item) => item.product_id === "c3-food")).toBe(false);
    });
  });

  describe("quantities", () => {
    it("keeps quantity 1 when no household size is given", () => {
      expect(buildBasket(request, products).items.every((item) => item.quantity === 1)).toBe(true);
    });

    it("plans per-person items for the household and the days covered", () => {
      expect(targetQuantity("food", "Rice", 4, 7)).toBe(8);
      expect(targetQuantity("food", "Rice", 4, 14)).toBe(16);
    });

    it("buys household items and kits once", () => {
      expect(targetQuantity("medicine", "Oral rehydration salts", 6, 7)).toBe(1);
      expect(targetQuantity("hygiene", "Family hygiene kit", 6, 7)).toBe(1);
      expect(targetQuantity("water", "Portable water filter", 6, 7)).toBe(1);
      expect(targetQuantity("food", "Emergency Food Supply Bucket", 6, 7)).toBe(1);
    });

    it("fills the household's quantity and keeps totals exact", () => {
      const result = buildBasket({ ...request, needs: ["food"], budget: 100, household_size: 4, days_of_cover: 7 }, products);
      const item = result.items[0]!;
      expect(item).toMatchObject({ product_id: "lentils", quantity: 8, unit_price: 3.2, subtotal: 25.6 });
      expect(result.total).toBe(25.6);
      expect(result.reserve).toBe(74.4);
    });

    it("buys fewer when the money runs short, and always keeps the reserve", () => {
      const result = buildBasket({ ...request, needs: ["food"], budget: 10, household_size: 4, days_of_cover: 7 }, products);
      expect(result.items[0]?.quantity).toBe(2);
      expect(result.total).toBeLessThanOrEqual(8);
      expect(result.reserve).toBeGreaterThanOrEqual(2);
    });

    it("leaves money for the other needs", () => {
      const result = buildBasket({ ...request, budget: 10, household_size: 4, days_of_cover: 7 }, products);
      expect(result.items.map((item) => item.product_id)).toEqual(["lentils", "water"]);
      expect(result.unmet_needs).toEqual([]);
    });
  });
});

