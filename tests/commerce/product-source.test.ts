import { describe, expect, it, vi } from "vitest";
import type { CommerceRequest } from "@lifeline/contracts";
import channel3Fixture from "../fixtures/channel3-search-success.json";
import { Channel3Source, CompositeProductSource, LocalRegistrySource, classifyProduct } from "../../apps/api/src/modules/commerce/product-source";

const request: CommerceRequest = { needs: ["food"], budget: 30, currency: "EUR", location: "Demo", reserve_ratio: 0.2 };

describe("commerce product sources", () => {
  it("serves the synthetic local catalogue without Channel3 credentials", async () => {
    const fetchMock = vi.fn();
    expect(await new Channel3Source("", fetchMock).search(request)).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
    const local = await new LocalRegistrySource().search(request);
    expect(local.length).toBeGreaterThanOrEqual(20);
    expect(local.every((product) => product.source === "local_registry" && product.currency === "EUR")).toBe(true);
  });

  it("falls back to local products when Channel3 is unavailable", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response("{}", { status: 503 }));
    const source = new CompositeProductSource([new LocalRegistrySource(), new Channel3Source("test-key", fetchMock)]);
    const products = await source.search(request);
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(products.length).toBeGreaterThanOrEqual(20);
    expect(products.every((product) => product.source === "local_registry")).toBe(true);
  });

  it("normalizes products from the captured Channel3 search response", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify(channel3Fixture), { status: 200 }));
    const fixtureProduct = channel3Fixture.products.find((product) => product.id === "O2BIPdo")!;
    const source = new Channel3Source("test-key", fetchMock);
    const products = await source.search({ ...request, needs: ["shelter"] });
    const normalized = products.find((product) => product.id === "channel3:O2BIPdo");

    expect(fetchMock).toHaveBeenCalledOnce();
    expect(products.length).toBeGreaterThan(0); // Confirms the body.products array is read.
    expect(`${fixtureProduct.category.slug} ${fixtureProduct.category.title}`).toMatch(/shelter/i);
    expect(`${fixtureProduct.title} ${fixtureProduct.description}`).not.toMatch(/shelter|tarp|tent/i);
    expect(normalized).toMatchObject({
      id: "channel3:O2BIPdo",
      name: fixtureProduct.title,
      description: fixtureProduct.description,
      category: "shelter",
      price: 22,
      currency: "EUR",
      merchantId: "channel3:rab.equipment",
      merchantName: "rab.equipment",
      availability: "available",
      source: "channel3",
    });
  });

  it("runs one Channel3 search per need and removes duplicates", async () => {
    const fetchMock = vi.fn().mockImplementation(async () => new Response(JSON.stringify(channel3Fixture), { status: 200 }));
    const products = await new Channel3Source("test-key", fetchMock).search({ ...request, needs: ["food", "shelter"] });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(new Set(products.map((product) => product.id)).size).toBe(products.length);
  });

  it("reuses a Channel3 answer instead of searching again", async () => {
    const fetchMock = vi.fn().mockImplementation(async () => new Response(JSON.stringify(channel3Fixture), { status: 200 }));
    const source = new Channel3Source("test-key", fetchMock);
    const first = await source.search({ ...request, needs: ["shelter"] });
    const again = await source.search({ ...request, needs: ["shelter"] });
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(again).toEqual(first);
    await source.search({ ...request, needs: ["shelter"], currency: "USD" });
    expect(fetchMock).toHaveBeenCalledTimes(2); // A different currency is a different search.
  });

  it("shares one call between searches made at the same time", async () => {
    const fetchMock = vi.fn().mockImplementation(async () => new Response(JSON.stringify(channel3Fixture), { status: 200 }));
    const source = new Channel3Source("test-key", fetchMock);
    await Promise.all([1, 2, 3].map(() => source.search({ ...request, needs: ["shelter"] })));
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it("never caches a failed Channel3 call", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response("{}", { status: 503 }))
      .mockImplementation(async () => new Response(JSON.stringify(channel3Fixture), { status: 200 }));
    const source = new Channel3Source("test-key", fetchMock);
    expect(await source.search({ ...request, needs: ["shelter"] })).toEqual([]);
    expect((await source.search({ ...request, needs: ["shelter"] })).length).toBeGreaterThan(0);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  describe("which online products count as essentials", () => {
    const needs = ["food", "water", "medicine", "baby_supplies"] as const;

    it.each([
      ["Red Bean TXA Food Mask"],
      ["Prepper Handbook: A Prepper's Survival Guide to Emergency Food and Water"],
      ["MISSHA - Super Aqua Ultra Hyalon Micellar Cleansing Water"],
      ["Water Hardness Strip"],
      ["Baby Watering Can"],
      ["Rectangular Flip-Tight Food Storage"],
      ["food container with lid"],
      ["Grain-Free Dog Food"],
    ])("rejects %s", (title) => {
      expect(classifyProduct(title, "", [], needs)).toBeNull();
    });

    it.each([
      ["Emergency Food Ration Packet", "food"],
      ["Portable Emergency Water Filter with 4-Stage System", "water"],
      ["Emergency Drinking Water Germicidal Tablets", "water"],
      ["First Aid Kit", "medicine"],
      ["Similac NeoSure Infant Formula Milk-Based Powder", "baby_supplies"],
    ])("accepts %s", (title, need) => {
      expect(classifyProduct(title, "", [], needs)).toBe(need);
    });

    it("ignores needs that weren't requested", () => {
      expect(classifyProduct("Emergency Food Ration Packet", "", [], ["water"])).toBeNull();
    });

    it("rejects a product filed under a non-essential category", () => {
      expect(classifyProduct("Rice Water Set", "Skin Care", ["health-beauty", "cosmetics", "skin-care"], ["food"])).toBeNull();
    });

    it("drops the captured Channel3 food mask and storage boxes", async () => {
      const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify(channel3Fixture), { status: 200 }));
      const products = await new Channel3Source("test-key", fetchMock).search(request);
      expect(products.some((product) => /food mask|food storage|freezer bags/i.test(product.name))).toBe(false);
    });
  });
});
