import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { SituationResult } from "@lifeline/contracts";
import { describe, expect, it } from "vitest";
import { caseModules } from "../../apps/api/src/orchestration/modules";
import { runCase } from "../../apps/api/src/orchestration/run-case";
import { evaluateRoutes as assessRoutes } from "../../apps/api/src/modules/finance/finance.service";
import { getDemoRouteCatalogue } from "../../apps/api/src/modules/finance/route-catalogue";

const sampleSituation: SituationResult = JSON.parse(
  readFileSync(join(import.meta.dirname, "../../packages/contracts/samples/situation-result.json"), "utf8"),
);
// Real Finance and Commerce; only the Situation Agent (one LLM call) is replaced.
const withSituation = (situation: SituationResult) => ({ ...caseModules, analyzeSituation: async () => situation });
const request = { message: "test", currency: "EUR", location: "Demo region" };

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

  it("uses Member 2's route catalogue", async () => {
    const ids = (await caseModules.routesFor("EUR", "Demo region")).map((route) => route.id);
    expect(ids).toEqual(expect.arrayContaining(["route_bank", "route_paypal"]));
  });

  it("uses a covered partner route when the family has no bank, wallet, or cash access", async () => {
    const noPaymentAccess: SituationResult = {
      ...sampleSituation,
      location: "Demo region",
      access: {
        ...sampleSituation.access,
        bank_availability: "unavailable",
        atm_access: "unavailable",
        wallet_acceptance: "unavailable",
        cash_availability: "unavailable",
        merchant_acceptance: "available",
        connectivity: "unavailable",
      },
    };
    const modules = {
      ...caseModules,
      analyzeSituation: async () => noPaymentAccess,
      routesFor: async () => getDemoRouteCatalogue(true),
      evaluateRoutes: (input: Parameters<typeof assessRoutes>[0]) => assessRoutes(input, {
        generateJson: async <T>() => ({ explanation: "The covered local supplier can provide the aid." }) as T,
      }),
    };

    const result = await runCase("case_partner_covered", request, modules);

    expect(result.status).toBe("complete");
    expect(result.finance?.recommended_route_id).toBe("route_partner");
    expect(result.commerce).not.toBeNull();
  });

  it("reports no safe route when no supplier covers the family's area", async () => {
    const noPaymentAccess: SituationResult = {
      ...sampleSituation,
      location: "Unserved region",
      access: {
        ...sampleSituation.access,
        bank_availability: "unavailable",
        atm_access: "unavailable",
        wallet_acceptance: "unavailable",
        cash_availability: "unavailable",
        merchant_acceptance: "available",
        connectivity: "unavailable",
      },
    };
    const modules = {
      ...caseModules,
      analyzeSituation: async () => noPaymentAccess,
      routesFor: async () => getDemoRouteCatalogue(false),
      evaluateRoutes: (input: Parameters<typeof assessRoutes>[0]) => assessRoutes(input, {
        generateJson: async <T>() => ({ explanation: "No verified route is available." }) as T,
      }),
    };

    const result = await runCase("case_partner_unserved", request, modules);

    expect(result.status).toBe("no_usable_route");
    expect(result.finance?.recommended_route_id).toBeNull();
    expect(result.commerce).toBeNull();
  });

  it("asks about wallet acceptance when it is the only thing holding the PayPal route back", async () => {
    const situation = { ...sampleSituation, location: "Demo region" };
    const result = await runCase("case_test_1", request, withSituation(situation));

    expect(result.status).toBe("needs_information");
    expect(result.missing_information).toContain("wallet_acceptance");
    expect(result.finance?.recommended_route_id).toBeNull();
    expect(result.commerce).toBeNull();
  });

  it("runs a complete case once the wallet is known to be accepted", async () => {
    const situation: SituationResult = {
      ...sampleSituation,
      location: "Demo region",
      access: { ...sampleSituation.access, wallet_acceptance: "available", connectivity: "available" },
    };
    const result = await runCase("case_test_2", request, withSituation(situation));

    expect(result.status).toBe("complete");
    expect(result.finance?.recommended_route_id).toBe("route_paypal");
    const route = result.finance?.routes.find((r) => r.route_id === "route_paypal");
    expect(route?.usable_value).toBe(285); // €300 minus the illustrative 5% fee
    expect(result.commerce?.total).toBeLessThanOrEqual(285 * 0.8);
    expect(result.commerce?.items.length).toBeGreaterThan(0);
  });
});
