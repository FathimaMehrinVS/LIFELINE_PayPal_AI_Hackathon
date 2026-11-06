import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  type CommerceResult,
  type FinanceRequest,
  type FinanceResult,
  type SituationResult,
  CaseResultSchema,
} from "@lifeline/contracts";
import { describe, expect, it, vi } from "vitest";
import { type CaseModules, runCase } from "../../apps/api/src/orchestration/run-case";

const sample = <T>(file: string): T =>
  JSON.parse(readFileSync(join(import.meta.dirname, "../../packages/contracts/samples", file), "utf8"));

const routes = sample<FinanceRequest>("finance-request.json").routes;
const financeResult = sample<FinanceResult>("finance-result.json");
const commerceResult = sample<CommerceResult>("commerce-result.json");

/** Priya after answering the follow-up questions: wallet works, location known. */
const situation: SituationResult = {
  ...sample<SituationResult>("situation-result.json"),
  location: "Demo region (synthetic)",
  access: sample<FinanceRequest>("finance-request.json").access,
};

function fakeModules(overrides: { situation?: SituationResult; finance?: FinanceResult } = {}) {
  const modules = {
    analyzeSituation: vi.fn(async () => overrides.situation ?? situation),
    evaluateRoutes: vi.fn(async () => overrides.finance ?? financeResult),
    buildBasket: vi.fn(async () => commerceResult),
    routesFor: vi.fn(() => routes),
  } satisfies CaseModules;
  return modules;
}

/** Finance result where nothing passes and PayPal is on review with no flags. */
const paypalOnReview: FinanceResult = {
  ...financeResult,
  recommended_route_id: null,
  routes: financeResult.routes.map((r) => (r.route_id === "route_paypal" ? { ...r, verdict: "review", flags: [] } : r)),
};

describe("runCase", () => {
  it("chains all three modules and returns a complete, valid case", async () => {
    const modules = fakeModules();
    const result = await runCase("case_1", { message: "..." }, modules);

    expect(CaseResultSchema.safeParse(result).success).toBe(true);
    expect(result.status).toBe("complete");
    expect(result.finance?.recommended_route_id).toBe("route_paypal");
    expect(result.commerce?.total).toBe(221);
  });

  it("gives the basket the money that actually arrives, not the original budget", async () => {
    const modules = fakeModules();
    await runCase("case_1", { message: "..." }, modules);

    expect(modules.evaluateRoutes).toHaveBeenCalledWith(expect.objectContaining({ amount: 300, currency: "EUR", routes }));
    expect(modules.buildBasket).toHaveBeenCalledWith({
      needs: situation.needs,
      budget: 285,
      currency: "EUR",
      location: "Demo region (synthetic)",
    });
  });

  it("stops before finance when budget, currency or location is missing, and asks for all of them", async () => {
    const modules = fakeModules({ situation: { ...situation, budget: null, currency: null, location: null } });
    const result = await runCase("case_2", { message: "please help" }, modules);

    expect(result.status).toBe("needs_information");
    expect(result.missing_information).toEqual(["budget", "currency", "location"]);
    expect(result.finance).toBeNull();
    expect(modules.evaluateRoutes).not.toHaveBeenCalled();
  });

  it("asks for unknown access when that is the only thing holding a route back", async () => {
    const unknownWallet = { ...situation, access: { ...situation.access, wallet_acceptance: "unknown" as const } };
    const modules = fakeModules({ situation: unknownWallet, finance: paypalOnReview });
    const result = await runCase("case_3", { message: "..." }, modules);

    expect(result.status).toBe("needs_information");
    expect(result.missing_information).toEqual(["wallet_acceptance"]);
    expect(result.finance).not.toBeNull();
    expect(modules.buildBasket).not.toHaveBeenCalled();
  });

  it("does not ask about unknowns when the route also has a warning flag", async () => {
    const unknownWallet = { ...situation, access: { ...situation.access, wallet_acceptance: "unknown" as const } };
    const flagged: FinanceResult = {
      ...paypalOnReview,
      routes: paypalOnReview.routes.map((r) =>
        r.route_id === "route_paypal" ? { ...r, flags: [{ code: "FEE_ABOVE_REFERENCE", severity: "warning", message: "..." }] } : r,
      ),
    };
    const result = await runCase("case_4", { message: "..." }, fakeModules({ situation: unknownWallet, finance: flagged }));

    expect(result.status).toBe("no_usable_route");
    expect(result.missing_information).toEqual([]);
  });

  it("returns no_usable_route when every route is blocked", async () => {
    const allBlocked: FinanceResult = {
      ...financeResult,
      recommended_route_id: null,
      routes: financeResult.routes.map((r) => ({ ...r, verdict: "block" })),
    };
    const modules = fakeModules({ finance: allBlocked });
    const result = await runCase("case_5", { message: "..." }, modules);

    expect(result.status).toBe("no_usable_route");
    expect(result.commerce).toBeNull();
    expect(modules.buildBasket).not.toHaveBeenCalled();
  });
});
