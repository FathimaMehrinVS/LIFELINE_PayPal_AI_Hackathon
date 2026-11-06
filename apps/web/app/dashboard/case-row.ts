import type { AllocationResult, CaseResult, Urgency } from "@lifeline/contracts";

// Owner: Member 1. One dashboard row: a case plus what happened when the NGO pressed Approve.

export type Approval =
  | { state: "pending" }
  | { state: "approved"; result: AllocationResult }
  | { state: "error"; message: string };

export interface CaseRow {
  case: CaseResult;
  approval?: Approval;
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

/** "route_paypal" → "Paypal" (the route catalogue's names arrive with Member 2's module). */
export function routeName(routeId: string) {
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
