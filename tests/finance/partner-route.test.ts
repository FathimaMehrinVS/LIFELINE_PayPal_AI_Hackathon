import { describe, expect, it } from "vitest";
import { getDemoRouteCatalogue, supplierCoversLocation } from "../../apps/api/src/modules/finance/route-catalogue";

describe("local partner route", () => {
  it("does not require family payment access and stays unverified without supplier coverage", () => {
    const route = getDemoRouteCatalogue().find((item) => item.id === "route_partner");

    expect(route).toMatchObject({
      type: "direct_merchant",
      requires: [],
      eligibility: "unverified",
      fee_label: "illustrative",
    });
  });

  it("verifies the route when approved supplier coverage is confirmed", () => {
    expect(getDemoRouteCatalogue(true).find((item) => item.id === "route_partner"))
      .toMatchObject({ eligibility: "verified" });
  });

  it("matches normalized service areas exactly", () => {
    expect(supplierCoversLocation("Kochi, Kerala", [" kerala "])).toBe(true);
    expect(supplierCoversLocation("Kochi", ["Kochi District"])).toBe(false);
  });
});

describe("partner coverage with labelled demo areas", () => {
  it("matches a family's place name against an area labelled (synthetic)", async () => {
    const { supplierCoversLocation } = await import("../../apps/api/src/modules/finance/route-catalogue");
    expect(supplierCoversLocation("Demo Town", ["Demo Town (synthetic)"])).toBe(true);
    expect(supplierCoversLocation("Kochi, Demo Town", ["Demo Town (synthetic)"])).toBe(true);
    expect(supplierCoversLocation("Far Hill Village", ["Demo Town (synthetic)"])).toBe(false);
    expect(supplierCoversLocation("Demo", ["Demo Town (synthetic)"])).toBe(false);
  });
});
