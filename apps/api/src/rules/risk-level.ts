export type RiskLevel = "NORMAL" | "URGENT" | "HIGH_RISK";
export type RiskUrgency = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
export type SupplierRiskStatus = "PENDING" | "APPROVED" | "SUSPENDED";

export interface RiskLevelInput {
  urgency: RiskUrgency;
  /** Situation facts still needed. Core case facts must not be treated as merely urgent. */
  missingInformation: readonly string[];
  supplierStatus?: SupplierRiskStatus | null;
  conflictingPaymentDetails?: boolean;
}

const ESSENTIAL_CASE_FACTS = new Set(["budget", "currency", "location", "needs"]);

/** Returns a display/triage level only; it never authorizes or bypasses a financial check. */
export function determineRiskLevel(input: RiskLevelInput): RiskLevel {
  if (input.supplierStatus === "SUSPENDED" || input.conflictingPaymentDetails === true) {
    return "HIGH_RISK";
  }

  const onlyNonessentialFactsMissing = input.missingInformation.length > 0 &&
    input.missingInformation.every((fact) => !ESSENTIAL_CASE_FACTS.has(fact.trim().toLowerCase()));
  if ((input.urgency === "HIGH" || input.urgency === "CRITICAL") && onlyNonessentialFactsMissing) {
    return "URGENT";
  }

  return "NORMAL";
}
