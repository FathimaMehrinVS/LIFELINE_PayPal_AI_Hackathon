import { describe, expect, it } from "vitest";
import type { FinancialRoute } from "@lifeline/contracts";
import { assessFees } from "../../apps/api/src/rules/fees";

const agentRoute: FinancialRoute = {
  id: "route_agent",
  name: "Local cash-out agent",
  type: "cash_agent",
  fee_fixed: 0,
  fee_percent: 20,
  fee_label: "illustrative",
  requires: ["cash_availability"],
  eligibility: "unverified",
};

describe("assessFees", () => {
  it("calculates rounded fees, usable value, and a review flag above the reference range", () => {
    expect(assessFees(300, agentRoute)).toEqual({
      estimated_fee: 60,
      usable_value: 240,
      flags: [
        {
          code: "FEE_ABOVE_REFERENCE",
          severity: "warning",
          message: "Fee appears higher than the reference range; review recommended.",
          evidence: {
            observed_percent: 20,
            reference_min_percent: 3,
            reference_max_percent: 6,
          },
        },
      ],
    });
  });
});
