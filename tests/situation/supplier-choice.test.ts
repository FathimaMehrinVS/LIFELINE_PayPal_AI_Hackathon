import { describe, expect, it } from "vitest";
import { singleSupplierProducts } from "../../apps/api/src/orchestration/supplier-choice";

const product = (merchantId: string, category: string) => ({ merchantId, category, name: `${category} from ${merchantId}` });
const products = [
  product("demo-market", "food"), product("demo-market", "water"),
  product("demo-health", "medicine"), product("demo-health", "water"),
  product("channel3:shop.example", "food"),
];

describe("one approved supplier per basket", () => {
  it("leaves out pending and unregistered suppliers", () => {
    const chosen = singleSupplierProducts(products, ["food", "medicine"], new Set(["demo-market"]));
    expect(chosen.map((item) => item.merchantId)).toEqual(["demo-market"]);
  });

  it("picks the supplier covering the most needs", () => {
    const chosen = singleSupplierProducts(products, ["medicine", "water"], new Set(["demo-market", "demo-health"]));
    expect(new Set(chosen.map((item) => item.merchantId))).toEqual(new Set(["demo-health"]));
  });

  it("returns nothing when no approved supplier sells what is needed", () => {
    expect(singleSupplierProducts(products, ["shelter"], new Set(["demo-market"]))).toEqual([]);
  });

  it("can include an external supplier once an NGO has approved it", () => {
    const chosen = singleSupplierProducts(products, ["food"], new Set(["channel3:shop.example"]));
    expect(chosen.map((item) => item.merchantId)).toEqual(["channel3:shop.example"]);
  });
});
