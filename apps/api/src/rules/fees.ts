import type { FinancialRoute, RiskFlag, RouteType } from "@lifeline/contracts";
import { percentOf, roundMoney } from "../utils/money";

/** Illustrative reference ranges for demos; they are not provider quotes. */
export const REFERENCE_FEE_RANGES: Partial<Record<RouteType, { min: number; max: number }>> = {
  paypal: { min: 3, max: 6 },
  digital_wallet: { min: 2, max: 6 },
  bank_transfer: { min: 0, max: 5 },
  // Kept at 3–6% to match the handoff's sample comparison.
  cash_agent: { min: 3, max: 6 },
  direct_merchant: { min: 0, max: 3 },
};

export interface FeeAssessment {
  estimated_fee: number;
  usable_value: number;
  flags: RiskFlag[];
}

export function assessFees(amount: number, route: FinancialRoute): FeeAssessment {
  const estimated_fee = roundMoney(route.fee_fixed + percentOf(amount, route.fee_percent));
  const usable_value = roundMoney(Math.max(0, amount - estimated_fee));
  const reference = REFERENCE_FEE_RANGES[route.type];
  const flags: RiskFlag[] = [];

  if (reference && route.fee_percent > reference.max) {
    flags.push({
      code: "FEE_ABOVE_REFERENCE",
      severity: "warning",
      message: "Fee appears higher than the reference range; review recommended.",
      evidence: {
        observed_percent: route.fee_percent,
        reference_min_percent: reference.min,
        reference_max_percent: reference.max,
      },
    });
  }

  return { estimated_fee, usable_value, flags };
}
