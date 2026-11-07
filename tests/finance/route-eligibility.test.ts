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

  it("passes a clean verified route and reviews unknown required access", () => {
    const walletRoute: FinancialRoute = {
      id: "route_paypal", name: "PayPal route", type: "paypal", fee_fixed: 0,
      fee_percent: 5, fee_label: "estimate", requires: ["wallet_acceptance"], eligibility: "verified",
    };
    expect(assessRouteEligibility(walletRoute, access, [])).toEqual({ verdict: "pass", flags: [] });
    expect(assessRouteEligibility(
      walletRoute,
      { ...access, wallet_acceptance: "unknown" },
      [],
    )).toEqual({ verdict: "review", flags: [] });
  });

  it("blocks unsupported corridors with a critical flag", () => {
    const unsupportedRoute: FinancialRoute = {
      ...bankRoute,
      eligibility: "unsupported",
    };
    expect(assessRouteEligibility(unsupportedRoute, access, [])).toMatchObject({
      verdict: "block",
      flags: [{ code: "ROUTE_UNSUPPORTED", severity: "critical" }],
    });
  });
});
