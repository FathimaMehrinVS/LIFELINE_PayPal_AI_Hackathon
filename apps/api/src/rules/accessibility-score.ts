import type { AccessFactorKey, AccessFactors, Availability, FinancialRoute } from "@lifeline/contracts";
import type { FeeAssessment } from "./fees";

export const ACCESSIBILITY_SCORE_VERSION = "v1";

/** Unknown access is scored as 0.25: it receives limited credit and is never assumed available. */
const STATUS_POINTS: Record<Availability, number> = {
  available: 1,
  limited: 0.5,
  unavailable: 0,
  unknown: 0.25,
};

const FACTOR_WEIGHTS: Record<AccessFactorKey | "cash_out_affordability", number> = {
  bank_availability: 0.2,
  atm_access: 0.1,
  wallet_acceptance: 0.2,
  cash_availability: 0.15,
  merchant_acceptance: 0.15,
  connectivity: 0.1,
  cash_out_affordability: 0.1,
};

export interface AccessibilityFactor {
  factor: AccessFactorKey | "cash_out_affordability";
  status: Availability;
  weight: number;
  points: number;
}

export interface AccessibilityAssessment {
  score: number;
  version: string;
  factors: AccessibilityFactor[];
}

export function assessAccessibility(
  route: FinancialRoute,
  access: AccessFactors,
  fees: FeeAssessment,
): AccessibilityAssessment {
  const required = new Set<AccessFactorKey>([
    ...route.requires,
    "merchant_acceptance",
    "connectivity",
  ]);
  const statuses = new Map<AccessFactorKey | "cash_out_affordability", Availability>();
  for (const factor of required) statuses.set(factor, access[factor]);

  const reference = route.type === "other" ? undefined : route.fee_percent;
  const benchmark = route.type === "other" ? undefined : fees.flags.some((flag) => flag.code === "FEE_ABOVE_REFERENCE");
  // Without a reference benchmark, affordability remains unknown. Above-reference fees are limited.
  const affordability: Availability = reference === undefined ? "unknown" : benchmark ? "limited" : "available";
  statuses.set("cash_out_affordability", affordability);

  const totalWeight = [...statuses.keys()].reduce((sum, key) => sum + FACTOR_WEIGHTS[key], 0);
  const factors = [...statuses.entries()].map(([factor, status]) => {
    const weight = FACTOR_WEIGHTS[factor] / totalWeight;
    return { factor, status, weight, points: weight * STATUS_POINTS[status] * 100 };
  });
  const score = Math.round(factors.reduce((sum, factor) => sum + factor.points, 0));

  return { score, version: ACCESSIBILITY_SCORE_VERSION, factors };
}
