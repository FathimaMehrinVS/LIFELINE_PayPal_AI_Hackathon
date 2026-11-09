import type { SupplierScorecard, SupplierStatus } from "@lifeline/contracts";

// Owner: Member 1. Plain code, no AI. Public ratings are never used: only orders and complaints recorded here.

/** Every supplier starts as if it had this many average orders, so a short record can't look like a long one. */
const PRIOR_ORDERS = 10;
const PRIOR_SUCCESS_RATE = 0.5;
const POINTS_PER_OPEN_COMPLAINT = 5;

export type FinishedOrderCounts = { completed: number; issues: number; openComplaints: number };

const onePlace = (value: number) => Math.round(value * 10) / 10;

export function supplierScorecard({ completed, issues, openComplaints }: FinishedOrderCounts): SupplierScorecard {
  const finished = completed + issues;
  if (finished === 0) {
    return { orders_finished: 0, orders_completed: 0, open_complaints: openComplaints, fulfilment_rate: null, score: null };
  }
  const weighted = ((completed + PRIOR_ORDERS * PRIOR_SUCCESS_RATE) / (finished + PRIOR_ORDERS)) * 100;
  return {
    orders_finished: finished,
    orders_completed: completed,
    open_complaints: openComplaints,
    fulfilment_rate: onePlace((completed / finished) * 100),
    score: onePlace(Math.max(0, weighted - openComplaints * POINTS_PER_OPEN_COMPLAINT)),
  };
}

/** The one rule for procurement: pending and suspended suppliers can't receive an order. */
export const canReceiveOrders = (status: SupplierStatus) => status === "approved";
