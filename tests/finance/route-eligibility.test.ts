import { describe, expect, it } from "vitest";
import type { AccessFactors, FinancialRoute } from "@lifeline/contracts";
import { assessRouteEligibility } from "../../apps/api/src/rules/route-eligibility";

const access: AccessFactors = {
  bank_availability: "unavailable", atm_access: "unavailable", wallet_acceptance: "available",
  cash_availability: "limited", merchant_acceptance: "available", connectivity: "limited",
};
const bankRoute: FinancialRoute = {
  id: "route_bank", name: "Bank transfer", type: "bank_transfer", fee_fixed: 0,
  fee_percent: 2, fee_label: "illustrative", requires: ["bank_availability"], eligibility: "verified",
};

describe("assessRouteEligibility", () => {
  it("blocks a route when a required access method is unavailable", () => {
    expect(assessRouteEligibility(bankRoute, access, [])).toMatchObject({
      verdict: "block",
      flags: [{
        code: "REQUIRED_ACCESS_UNAVAILABLE",
        severity: "critical",
        evidence: { factor: "bank_availability", status: "unavailable" },
      }],
    });
  });

  it("sends unverified or warning-flagged routes for review", () => {
    const agentRoute: FinancialRoute = {
      id: "route_agent", name: "Local agent", type: "cash_agent", fee_fixed: 0,
      fee_percent: 20, fee_label: "illustrative", requires: ["cash_availability"], eligibility: "unverified",
    };
    const feeWarning = {
      code: "FEE_ABOVE_REFERENCE",
      severity: "warning" as const,
      message: "Fee appears higher than the reference range; review recommended.",
    };
    expect(assessRouteEligibility(agentRoute, access, [feeWarning])).toMatchObject({
      verdict: "review",
      flags: [feeWarning],
    });
  });
});
