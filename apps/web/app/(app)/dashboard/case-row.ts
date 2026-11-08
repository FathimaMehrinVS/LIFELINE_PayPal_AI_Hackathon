import type { AllocationResult, CaseResult, PayoutResult, Urgency } from "@lifeline/contracts";

// Owner: Member 1. One dashboard row: a case plus what happened when the NGO pressed Approve.

export type Approval =
  | { state: "pending" }
  | { state: "approved"; result: AllocationResult }
  | { state: "error"; message: string };

export type Disbursement =
  | { state: "pending" }
  | { state: "complete"; result: PayoutResult }
  | { state: "error"; message: string };

export interface CaseRow {
  case: CaseResult;
  approval?: Approval;
  disbursement?: Disbursement;
}

export const URGENCY_RANK: Record<Urgency, number> = { critical: 4, high: 3, medium: 2, low: 1 };

export const STATUS_LABELS: Record<CaseResult["status"], string> = {
  complete: "Ready for approval",
  needs_information: "Needs information",
  no_usable_route: "No usable route",
};

export function recommendedRoute(c: CaseResult) {
  return c.finance?.routes.find((r) => r.route_id === c.finance?.recommended_route_id) ?? null;
}

/** Names from Member 2's demo route catalogue (modules/finance/route-catalogue.ts). */
const ROUTE_NAMES: Record<string, string> = {
  route_bank: "Bank transfer",
  route_agent: "Local cash-out agent",
  route_paypal: "PayPal",
};

/** "route_paypal" → "PayPal"; unknown ids are turned into readable words. */
export function routeName(routeId: string) {
  if (ROUTE_NAMES[routeId]) return ROUTE_NAMES[routeId];
  const name = routeId.replace(/^route_/, "").replace(/_/g, " ");
  return (name.charAt(0).toUpperCase() + name.slice(1)).replace(/paypal/i, "PayPal");
}

export function formatMoney(amount: number | null | undefined, currency: string | null | undefined) {
  if (amount === null || amount === undefined) return "";
  if (!currency) return amount.toLocaleString();
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency }).format(amount);
  } catch {
    return `${amount.toLocaleString()} ${currency}`;
  }
}
