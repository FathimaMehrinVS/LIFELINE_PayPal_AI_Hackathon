import { describe, expect, it } from "vitest";
import { getDemoRouteCatalogue } from "../../apps/api/src/modules/finance/route-catalogue";

describe("finance demo route catalogue", () => {
  it("contains synthetic routes and labels every unconfirmed fee illustrative", () => {
    const routes = getDemoRouteCatalogue();
    expect(routes).toHaveLength(4);
    expect(routes.find((route) => route.id === "route_partner")).toMatchObject({
      type: "direct_merchant",
      requires: [],
      eligibility: "unverified",
    });
    expect(routes.every((route) => route.fee_label === "illustrative")).toBe(true);
  });
});
