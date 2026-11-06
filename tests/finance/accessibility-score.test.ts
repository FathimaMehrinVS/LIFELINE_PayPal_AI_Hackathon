import { describe, expect, it } from "vitest";
import type { AccessFactors, FinancialRoute } from "@lifeline/contracts";
import { assessAccessibility } from "../../apps/api/src/rules/accessibility-score";
import { assessFees } from "../../apps/api/src/rules/fees";

const route: FinancialRoute = {
  id: "route_paypal", name: "PayPal-supported route", type: "paypal", fee_fixed: 0,
  fee_percent: 5, fee_label: "estimate", requires: ["wallet_acceptance"], eligibility: "verified",
};
const access: AccessFactors = {
  bank_availability: "available", atm_access: "available", wallet_acceptance: "available",
  cash_availability: "available", merchant_acceptance: "available", connectivity: "available",
};

describe("assessAccessibility", () => {
  it("returns a versioned score with normalized route-relevant factor weights", () => {
    const score = assessAccessibility(route, access, assessFees(300, route));
    expect(score).toMatchObject({ version: "v1", score: 100 });
    expect(score.factors.map((factor) => factor.factor)).toEqual([
      "wallet_acceptance", "merchant_acceptance", "connectivity", "cash_out_affordability",
    ]);
    expect(score.factors.reduce((sum, factor) => sum + factor.weight, 0)).toBeCloseTo(1);
  });
});
