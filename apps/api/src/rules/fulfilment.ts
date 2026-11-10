export const FULFILMENT_STATUSES = [
  "AWAITING_ACCEPTANCE",
  "ACCEPTED",
  "PREPARING",
  "READY",
  "DISPATCHED",
  "HANDED_OVER",
  "RECIPIENT_CONFIRMED",
  "ISSUE_REPORTED",
] as const;

export type FulfilmentStatus = (typeof FULFILMENT_STATUSES)[number];
export type FulfilmentActor = "SUPPLIER" | "NGO" | "RECIPIENT";

const NEXT_STATUSES: Record<FulfilmentStatus, readonly FulfilmentStatus[]> = {
  AWAITING_ACCEPTANCE: ["ACCEPTED", "ISSUE_REPORTED"],
  ACCEPTED: ["PREPARING", "ISSUE_REPORTED"],
  PREPARING: ["READY", "ISSUE_REPORTED"],
  READY: ["DISPATCHED", "HANDED_OVER", "ISSUE_REPORTED"],
  DISPATCHED: ["HANDED_OVER", "ISSUE_REPORTED"],
  HANDED_OVER: ["RECIPIENT_CONFIRMED", "ISSUE_REPORTED"],
  RECIPIENT_CONFIRMED: [],
  ISSUE_REPORTED: ["PREPARING", "READY"],
};

export interface FulfilmentTransitionContext {
  pickupCodeVerified?: boolean;
}

/** Validates the state move, actor, and pickup-code requirement for a fulfilment update. */
export function canTransitionFulfilment(
  current: FulfilmentStatus,
  next: FulfilmentStatus,
  actor: FulfilmentActor,
  context: FulfilmentTransitionContext = {},
): boolean {
  if (!NEXT_STATUSES[current].includes(next)) return false;

  if (next === "RECIPIENT_CONFIRMED") return actor !== "SUPPLIER" && context.pickupCodeVerified === true;
  if (actor === "RECIPIENT") return next === "ISSUE_REPORTED";

  return true;
}
