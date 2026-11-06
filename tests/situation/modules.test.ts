import { describe, expect, it } from "vitest";
import { caseModules } from "../../apps/api/src/orchestration/modules";

// The real module wiring. Tests never load .env, so Channel3 is skipped and the LLM ranking fails safely:
// the basket comes from Member 3's local registry and rules alone, without network or database.

describe("caseModules", () => {
  it("builds a real basket from the local registry within the spendable budget", async () => {
    const basket = await caseModules.buildBasket({ needs: ["food", "medicine"], budget: 285, currency: "EUR", location: "Demo region" });

    expect(basket.items.length).toBeGreaterThan(0);
    expect(basket.items.every((item) => item.source === "local_registry")).toBe(true);
    expect(basket.total).toBeLessThanOrEqual(285 * 0.8);
    expect(basket.reserve).toBeGreaterThanOrEqual(285 * 0.2);
  });

  it("reports needs it can't cover instead of inventing products", async () => {
    // The demo registry only has EUR prices.
    const basket = await caseModules.buildBasket({ needs: ["food"], budget: 5000, currency: "INR", location: "Kerala" });
    expect(basket.items).toEqual([]);
    expect(basket.unmet_needs).toContain("food");
  });

  it("says Finance is not merged yet", () => {
    expect(() => caseModules.routesFor("EUR")).toThrow(/not merged yet/);
  });
});
