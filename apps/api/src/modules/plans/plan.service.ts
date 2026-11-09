import type { Contribution, DonorPlan, DonorPlanDetail, NeedCategory, PlanStep, Urgency } from "@lifeline/contracts";
import type { getPrisma } from "../../database/prisma";
import { Prisma } from "../../generated/prisma/client";
import { HttpError } from "../../utils/http-error";
import { roundMoney } from "../../utils/money";

// Owner: Member 1. What donors can see of an approved plan.
// The query selects named fields only, so a family's message, location and reported summary never leave the database.

type Database = ReturnType<typeof getPrisma>;

export const DEMO_HISTORY_PREFIX = "demo_hist_";

const planSelect = {
  id: true,
  requestId: true,
  amount: true,
  currency: true,
  status: true,
  approvedAt: true,
  campaign: { select: { active: true } },
  request: {
    select: {
      status: true,
      situation: { select: { needs: true, urgency: true } },
      basket: { select: { total: true, items: { select: { name: true, merchantName: true, quantity: true, subtotal: true, priceLabel: true } } } },
    },
  },
  donations: { where: { status: "CAPTURED" }, select: { amount: true, updatedAt: true }, orderBy: { updatedAt: "desc" } },
  payouts: { select: { status: true, mode: true, createdAt: true }, orderBy: { createdAt: "desc" }, take: 1 },
  purchaseOrder: { select: { createdAt: true, merchant: { select: { name: true } }, events: { select: { status: true, createdAt: true }, orderBy: { createdAt: "asc" } } } },
} satisfies Prisma.AidAllocationSelect;

type PlanRow = Prisma.AidAllocationGetPayload<{ select: typeof planSelect }>;

const visiblePlans = {
  id: { not: { startsWith: DEMO_HISTORY_PREFIX } },
  status: { in: ["APPROVED", "DISBURSED", "COMPLETED"] },
  approvedAt: { not: null },
} satisfies Prisma.AidAllocationWhereInput;

const NEED_LABEL: Record<NeedCategory, string> = {
  food: "food", water: "clean water", medicine: "medicine", shelter: "shelter", hygiene: "hygiene supplies",
  baby_supplies: "baby supplies", clothing: "clothing", transport: "transport", other: "other essentials",
};

function needsList(needs: NeedCategory[]): string {
  const labels = needs.map((need) => NEED_LABEL[need]);
  if (labels.length === 0) return "essential supplies";
  return labels.length === 1 ? labels[0]! : `${labels.slice(0, -1).join(", ")} and ${labels.at(-1)}`;
}

const capitalise = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

export const planReference = (allocationId: string) => `AP-${allocationId.slice(-6).toUpperCase()}`;

const FULFILMENT_STEPS = [
  ["ACCEPTED", "Supplier accepted the order"],
  ["PREPARING", "Goods being prepared"],
  ["READY", "Goods ready"],
  ["DISPATCHED", "Goods dispatched"],
  ["HANDED_OVER", "Handover recorded"],
  ["VERIFIED", "NGO verified delivery"],
] as const;

/** Each step comes from a saved record. A step with no record stays "not_recorded"; nothing is inferred. */
export function planSteps(plan: Pick<PlanRow, "status" | "amount" | "currency" | "approvedAt" | "payouts" | "purchaseOrder">, captured: number): PlanStep[] {
  const goal = plan.amount.toNumber();
  const lastOf = (status: string) => plan.purchaseOrder?.events.filter((event) => event.status === status).at(-1);
  const payout = plan.payouts[0];
  const steps: PlanStep[] = [
    { key: "approved", title: "NGO approval", state: plan.approvedAt ? "complete" : "not_recorded", simulated: false, detail: null, at: plan.approvedAt?.toISOString() ?? null },
    {
      key: "funding",
      title: "Funding",
      state: captured >= goal ? "complete" : captured > 0 ? "in_progress" : "not_recorded",
      simulated: false,
      detail: captured > 0 ? `${captured.toFixed(2)} of ${goal.toFixed(2)} ${plan.currency} confirmed by PayPal Sandbox` : "No payment confirmed yet",
      at: null,
    },
    {
      key: "order",
      title: "Order placed with supplier",
      state: plan.purchaseOrder ? "complete" : "not_recorded",
      simulated: false,
      detail: plan.purchaseOrder?.merchant.name ?? null,
      at: plan.purchaseOrder?.createdAt.toISOString() ?? null,
    },
    {
      key: "supplier_payment",
      title: "Supplier payment",
      state: !payout ? "not_recorded" : payout.status === "COMPLETED" ? "complete" : payout.status === "FAILED" || payout.status === "RETURNED" ? "issue" : "in_progress",
      simulated: payout?.mode === "SIMULATED",
      detail: payout?.mode === "SIMULATED" ? "Simulated. No money was transferred" : null,
      at: payout?.createdAt.toISOString() ?? null,
    },
    ...FULFILMENT_STEPS.map(([status, title]): PlanStep => {
      const event = lastOf(status) ?? (status === "VERIFIED" ? lastOf("RECIPIENT_CONFIRMED") : undefined);
      return { key: status.toLowerCase(), title, state: event ? "complete" : "not_recorded", simulated: Boolean(event), detail: null, at: event?.createdAt.toISOString() ?? null };
    }),
    {
      key: "completed",
      title: "Assistance completed",
      state: plan.status === "COMPLETED" ? "complete" : "not_recorded",
      simulated: false,
      detail: null,
      at: plan.purchaseOrder?.events.filter((event) => event.status === "VERIFIED").at(-1)?.createdAt.toISOString() ?? null,
    },
  ];
  const issue = lastOf("ISSUE_REPORTED");
  if (issue) steps.push({ key: "issue_reported", title: "A problem was reported", state: "issue", simulated: false, detail: "The NGO is reviewing this order", at: issue.createdAt.toISOString() });
  return steps;
}

function toPlan(row: PlanRow): DonorPlan {
  const needs = (row.request.situation?.needs ?? []) as NeedCategory[];
  const goal = row.amount.toNumber();
  const captured = roundMoney(row.donations.reduce((sum, donation) => sum + donation.amount.toNumber(), 0));
  const remaining = roundMoney(Math.max(goal - captured, 0));
  return {
    plan_id: row.id,
    case_id: row.requestId,
    reference: planReference(row.id),
    title: `${capitalise(needsList(needs))} support`,
    description: `An NGO reviewed this request and approved support for ${needsList(needs)}.`,
    needs,
    urgency: (row.request.situation?.urgency.toLowerCase() ?? "medium") as Urgency,
    currency: row.currency,
    approved_at: row.approvedAt?.toISOString() ?? null,
    can_fund: row.status === "APPROVED" && row.request.status === "APPROVED" && row.campaign.active && remaining > 0,
    delivery_confirmed_at: row.purchaseOrder?.events.filter((event) => event.status === "VERIFIED" || event.status === "RECIPIENT_CONFIRMED").at(-1)?.createdAt.toISOString() ?? null,
    funding: { goal, captured, remaining, percent: goal > 0 ? Math.min(Math.round((captured / goal) * 100), 100) : 0, donations: row.donations.length },
  };
}

function toDetail(row: PlanRow): DonorPlanDetail {
  const plan = toPlan(row);
  const basket = row.request.basket;
  return {
    ...plan,
    items: (basket?.items ?? []).map((item) => ({ name: item.name, supplier: item.merchantName, quantity: item.quantity, cost: item.subtotal.toNumber(), price_label: item.priceLabel })),
    not_itemised: roundMoney(Math.max(plan.funding.goal - (basket?.total.toNumber() ?? 0), 0)),
    steps: planSteps(row, plan.funding.captured),
  };
}

export async function listPlans(db: Database): Promise<DonorPlan[]> {
  const rows = await db.aidAllocation.findMany({ where: visiblePlans, select: planSelect, orderBy: { approvedAt: "desc" } });
  return rows.map(toPlan);
}

export async function getPlan(db: Database, id: string): Promise<DonorPlanDetail> {
  const row = await db.aidAllocation.findFirst({ where: { ...visiblePlans, id }, select: planSelect });
  if (!row) throw new HttpError("NOT_FOUND", "Approved plan not found");
  return toDetail(row);
}

/** One donor's own donations. Abandoned, cancelled and failed checkouts are left out. */
export async function listContributions(db: Database, donorId: string): Promise<Contribution[]> {
  const donations = await db.donation.findMany({
    where: { donorId, status: { in: ["CREATED", "APPROVED", "CAPTURED", "REFUNDED"] }, allocation: { is: visiblePlans } },
    select: { id: true, status: true, amount: true, currency: true, paypalCaptureId: true, createdAt: true, allocation: { select: planSelect } },
    orderBy: { createdAt: "desc" },
  });
  return donations.flatMap((donation) => donation.allocation ? [{
    donation_id: donation.id,
    reference: `DN-${donation.id.slice(-6).toUpperCase()}`,
    status: donation.status.toLowerCase() as Contribution["status"],
    amount: donation.amount.toNumber(),
    currency: donation.currency,
    paypal_capture_id: donation.paypalCaptureId,
    created_at: donation.createdAt.toISOString(),
    plan: toDetail(donation.allocation),
  }] : []);
}
