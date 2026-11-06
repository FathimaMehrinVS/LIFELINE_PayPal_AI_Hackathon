import { describe, expect, it, vi } from "vitest";
import type { CommerceRequest } from "@lifeline/contracts";
import { Channel3Source, CompositeProductSource, LocalRegistrySource } from "../../apps/api/src/modules/commerce/product-source";

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
});
