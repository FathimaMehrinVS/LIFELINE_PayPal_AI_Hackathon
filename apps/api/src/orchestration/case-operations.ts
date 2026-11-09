import type { CaseOperations, CaseResult, CaseTimelineEntry } from "@lifeline/contracts";
import { getPrisma } from "../database/prisma";
import { roundMoney } from "../utils/money";
import { HttpError } from "../utils/http-error";
import { CASE_AUDIT_ACTION } from "./case-store";
import { determineRiskLevel } from "../rules/risk-level";

// Owner: Member 1. What has actually happened to each case since it was saved, read from the money records.
// Only recorded facts appear here: a captured donation never implies that a supplier was paid.

type Database = ReturnType<typeof getPrisma>;

export async function attachOperations(db: Database, cases: CaseResult[]): Promise<CaseResult[]> {
  if (cases.length === 0) return cases;
  const allocations = await db.aidAllocation.findMany({
    where: { requestId: { in: cases.map((item) => item.case_id) } },
    include: {
      donations: { where: { status: "CAPTURED" }, select: { amount: true } },
      payouts: { orderBy: { createdAt: "desc" }, take: 1 },
      purchaseOrder: { select: { id: true, fulfilmentStatus: true, merchant: { select: { name: true, status: true } }, partnerUser: { select: { name: true } } } },
    },
  });
  const byCase = new Map<string, CaseOperations>(allocations.map((allocation) => {
    const payout = allocation.payouts[0];
    return [allocation.requestId, {
      allocation: {
        allocation_id: allocation.id,
        case_id: allocation.requestId,
        status: allocation.status.toLowerCase() as NonNullable<CaseOperations["allocation"]>["status"],
        amount: allocation.amount.toNumber(),
        currency: allocation.currency,
        approved_at: allocation.approvedAt?.toISOString() ?? null,
      },
      funding: { captured: roundMoney(allocation.donations.reduce((sum, donation) => sum + donation.amount.toNumber(), 0)), donations: allocation.donations.length },
      payout: payout ? {
        payout_id: payout.id,
        allocation_id: payout.allocationId,
        ...(payout.purchaseOrderId ? { purchase_order_id: payout.purchaseOrderId } : {}),
        ...(payout.reference ? { reference: payout.reference } : {}),
        status: payout.status.toLowerCase() as NonNullable<CaseOperations["payout"]>["status"],
        amount: payout.amount.toNumber(),
        currency: payout.currency,
        mode: payout.mode.toLowerCase() as NonNullable<CaseOperations["payout"]>["mode"],
      } : null,
      delivery: allocation.purchaseOrder ? {
        purchase_order_id: allocation.purchaseOrder.id,
        fulfilment_status: allocation.purchaseOrder.fulfilmentStatus.toLowerCase() as NonNullable<CaseOperations["delivery"]>["fulfilment_status"],
        merchant_name: allocation.purchaseOrder.merchant.name,
        partner_name: allocation.purchaseOrder.partnerUser?.name ?? null,
      } : null,
    }];
  }));
  const risks = new Map(allocations.map((allocation) => [
    allocation.requestId,
    allocation.purchaseOrder?.merchant.status ?? null,
  ]));
  return cases.map((item) => ({
    ...item,
    risk_level: determineRiskLevel({
      urgency: item.situation.urgency.toUpperCase() as "LOW" | "MEDIUM" | "HIGH" | "CRITICAL",
      missingInformation: item.situation.missing_information,
      supplierStatus: risks.get(item.case_id),
    }),
    operations: byCase.get(item.case_id) ?? { allocation: null, funding: { captured: 0, donations: 0 }, payout: null, delivery: null },
  }));
}

const ACTIVITY_TITLES: Record<string, { title: string; kind: CaseTimelineEntry["kind"] }> = {
  [CASE_AUDIT_ACTION]: { title: "Case recorded", kind: "case" },
  "allocation.approved": { title: "Plan approved by NGO", kind: "approval" },
  "allocation.disbursement_simulated": { title: "Simulated disbursement recorded", kind: "payment" },
  "delivery.assigned": { title: "Partner assigned to delivery", kind: "supplier" },
  "delivery.status_changed": { title: "Delivery preparation updated", kind: "supplier" },
  "delivery.handover_recorded": { title: "Handover recorded by partner", kind: "supplier" },
  "delivery.verified": { title: "Delivery verified by NGO", kind: "supplier" },
  "delivery.recipient_confirmed": { title: "Recipient collection confirmed", kind: "supplier" },
  "purchase_order.created": { title: "Purchase order created", kind: "supplier" },
  "supplier.payment_simulated": { title: "Simulated supplier payment recorded", kind: "payment" },
  "allocation.completed": { title: "Assistance completed", kind: "approval" },
  "supplier.registered": { title: "Supplier registered", kind: "supplier" },
  "supplier.status_changed": { title: "Supplier status changed", kind: "supplier" },
};

/** The latest recorded events across the NGO's work, newest first. */
export async function getRecentActivity(db: Database, limit = 6): Promise<CaseTimelineEntry[]> {
  const logs = await db.auditLog.findMany({ where: { action: { in: Object.keys(ACTIVITY_TITLES) } }, orderBy: { createdAt: "desc" }, take: limit });
  return logs.map((log) => {
    const { title, kind } = ACTIVITY_TITLES[log.action]!;
    const reference = log.entityId.startsWith("case_") ? `LL-${log.entityId.slice(5, 13).toUpperCase()}` : null;
    const to = (log.details as { to?: unknown } | null)?.to;
    const caseId = (log.details as { case_id?: unknown } | null)?.case_id;
    const caseReference = reference ?? (typeof caseId === "string" ? `LL-${caseId.replace(/^case_/, "").slice(0, 8).toUpperCase()}` : null);
    return { kind, title: log.action === "supplier.status_changed" && typeof to === "string" ? `Supplier ${to}` : title, detail: caseReference, at: log.createdAt.toISOString() };
  });
}

const money = (amount: { toFixed(places: number): string }, currency: string) => `${amount.toFixed(2)} ${currency}`;

/** Every recorded step for one case, oldest first. A step with no record is simply absent. */
export async function getCaseTimeline(db: Database, caseId: string): Promise<CaseTimelineEntry[]> {
  const [saves, allocation] = await Promise.all([
    db.auditLog.findMany({ where: { action: CASE_AUDIT_ACTION, entityType: "AssistanceRequest", entityId: caseId }, orderBy: { createdAt: "asc" }, select: { createdAt: true } }),
    db.aidAllocation.findUnique({ where: { requestId: caseId }, include: { donations: true, payouts: true } }),
  ]);
  if (saves.length === 0) throw new HttpError("NOT_FOUND", "Assistance case not found");

  const entries: CaseTimelineEntry[] = saves.map((save, index) => ({
    kind: "case",
    title: index === 0 ? "Request recorded" : "Details added and checked again",
    detail: index === 0 ? "AI assessment completed" : null,
    at: save.createdAt.toISOString(),
  }));
  if (allocation?.approvedAt) {
    entries.push({ kind: "approval", title: "Approved by NGO", detail: money(allocation.amount, allocation.currency), at: allocation.approvedAt.toISOString() });
  }
  for (const donation of allocation?.donations ?? []) {
    const amount = money(donation.amount, donation.currency);
    if (donation.status === "CAPTURED") entries.push({ kind: "donation", title: "Donation captured", detail: `${amount} · confirmed with PayPal Sandbox`, at: donation.updatedAt.toISOString() });
    else if (donation.status === "CANCELLED" || donation.status === "FAILED") entries.push({ kind: "donation", title: donation.status === "FAILED" ? "Donation failed" : "Donation cancelled", detail: amount, at: donation.updatedAt.toISOString() });
    else entries.push({ kind: "donation", title: "Donation started", detail: `${amount} · not captured yet`, at: donation.createdAt.toISOString() });
  }
  for (const payout of allocation?.payouts ?? []) {
    entries.push({ kind: "payment", title: payout.mode === "SIMULATED" ? "Simulated disbursement recorded" : "Payment recorded", detail: payout.mode === "SIMULATED" ? "No money was transferred" : money(payout.amount, payout.currency), at: payout.createdAt.toISOString() });
  }
  if (allocation) {
    const deliveryLogs = await db.auditLog.findMany({
      where: { entityType: "AidAllocation", entityId: allocation.id, action: { in: ["delivery.assigned", "delivery.status_changed", "delivery.handover_recorded", "delivery.verified", "delivery.recipient_confirmed", "allocation.completed"] } },
      orderBy: { createdAt: "asc" },
    });
    for (const log of deliveryLogs) {
      const entry = ACTIVITY_TITLES[log.action];
      if (entry) entries.push({ kind: entry.kind, title: entry.title, detail: null, at: log.createdAt.toISOString() });
    }
  }
  return entries.sort((a, b) => a.at.localeCompare(b.at));
}
