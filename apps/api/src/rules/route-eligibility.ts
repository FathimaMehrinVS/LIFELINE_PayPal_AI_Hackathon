import type { AccessFactors, FinancialRoute, RiskFlag, RouteAssessment } from "@lifeline/contracts";
import type { AccessibilityAssessment } from "./accessibility-score";
import type { FeeAssessment } from "./fees";

export interface EligibilityAssessment {
  verdict: RouteAssessment["verdict"];
  flags: RiskFlag[];
}

export function assessRouteEligibility(
  route: FinancialRoute,
  access: AccessFactors,
  feeFlags: RiskFlag[],
): EligibilityAssessment {
  const flags = [...feeFlags];
  const unavailable = route.requires.find((factor) => access[factor] === "unavailable");
  const unknown = route.requires.some((factor) => access[factor] === "unknown");

  if (route.eligibility === "unsupported") {
    flags.push({
      code: "ROUTE_UNSUPPORTED",
      severity: "critical",
      message: "This route is not supported for the stated corridor.",
    });
    return { verdict: "block", flags };
  }

  if (unavailable) {
    flags.push({
      code: "REQUIRED_ACCESS_UNAVAILABLE",
      severity: "critical",
      message: "A required access method for this route is unavailable.",
      evidence: { factor: unavailable, status: "unavailable" },
    });
    return { verdict: "block", flags };
  }

  if (
    route.eligibility === "unverified" ||
    unknown ||
    flags.some((flag) => flag.severity === "warning")
  ) {
    return { verdict: "review", flags };
  }

  return { verdict: "pass", flags };
}

/** Composes independently calculated route rules into the shared assessment contract. */
export function buildRouteAssessment(
  route: FinancialRoute,
  access: AccessFactors,
  fees: FeeAssessment,
  accessibility: AccessibilityAssessment,
): RouteAssessment {
  const eligibility = assessRouteEligibility(route, access, fees.flags);
  return {
    route_id: route.id,
    estimated_fee: fees.estimated_fee,
    fee_label: route.fee_label,
    usable_value: fees.usable_value,
    accessibility,
    verdict: eligibility.verdict,
    flags: eligibility.flags,
  };
}
