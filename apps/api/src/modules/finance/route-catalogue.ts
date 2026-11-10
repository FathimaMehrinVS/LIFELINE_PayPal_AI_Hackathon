import type { FinancialRoute } from "@lifeline/contracts";

/** Synthetic demo routes; all fees are illustrative and are not provider quotes. */
const DEMO_ROUTE_CATALOGUE: readonly FinancialRoute[] = [
  {
    id: "route_bank",
    name: "Bank transfer",
    type: "bank_transfer",
    fee_fixed: 0,
    fee_percent: 2,
    fee_label: "illustrative",
    requires: ["bank_availability"],
    eligibility: "verified",
    estimated_minutes: 2880,
  },
  {
    id: "route_agent",
    name: "Local cash-out agent",
    type: "cash_agent",
    fee_fixed: 0,
    fee_percent: 20,
    fee_label: "illustrative",
    requires: ["cash_availability"],
    eligibility: "unverified",
    estimated_minutes: 120,
  },
  {
    id: "route_paypal",
    name: "PayPal-supported route",
    type: "paypal",
    fee_fixed: 0,
    fee_percent: 5,
    fee_label: "illustrative",
    requires: ["wallet_acceptance", "connectivity"],
    eligibility: "verified",
    estimated_minutes: 10,
  },
  {
    id: "route_partner",
    name: "Local aid supplier",
    type: "direct_merchant",
    fee_fixed: 0,
    fee_percent: 2,
    fee_label: "illustrative",
    requires: [],
    eligibility: "unverified",
    estimated_minutes: 1440,
  },
];

/** Exact normalized area matching avoids claiming coverage based on a loose substring match. */
export function supplierCoversLocation(location: string, serviceAreas: readonly string[]): boolean {
  const normalize = (value: string) => value.normalize("NFKC").trim().toLocaleLowerCase().replace(/\s+/g, " ");
  const caseAreas = new Set(location.split(",").map(normalize).filter(Boolean));
  return serviceAreas.some((area) => caseAreas.has(normalize(area)));
}

/** Return fresh objects; a local partner is verified only when approved supplier coverage is confirmed. */
export function getDemoRouteCatalogue(partnerCoversLocation = false): FinancialRoute[] {
  return DEMO_ROUTE_CATALOGUE.map((route) => ({
    ...route,
    ...(route.id === "route_partner" ? { eligibility: partnerCoversLocation ? "verified" as const : "unverified" as const } : {}),
    requires: [...route.requires],
  }));
}
