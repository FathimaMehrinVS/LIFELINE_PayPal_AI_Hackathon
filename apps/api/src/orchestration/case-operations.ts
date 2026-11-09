import type { CaseOperations, CaseResult, CaseTimelineEntry } from "@lifeline/contracts";
import { getPrisma } from "../database/prisma";
import { roundMoney } from "../utils/money";
import { HttpError } from "../utils/http-error";
import { CASE_AUDIT_ACTION } from "./case-store";

// Owner: Member 1. What has actually happened to each case since it was saved, read from the money records.
// Only recorded facts appear here: a captured donation never implies that a supplier was paid.

type Database = ReturnType<typeof getPrisma>;

export async function attachOperations(db: Database, cases: CaseResult[]): Promise<CaseResult[]> {
  if (cases.length === 0) return cases;
  const allocations = await db.aidAllocation.findMany({
    where: { requestId: { in: cases.map((item) => item.case_id) } },
    include: { donations: { where: { status: "CAPTURED" }, select: { amount: true } }, payouts: { orderBy: { createdAt: "desc" }, take: 1 } },
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
        status: payout.status.toLowerCase() as NonNullable<CaseOperations["payout"]>["status"],
        amount: payout.amount.toNumber(),
        currency: payout.currency,
        mode: payout.mode.toLowerCase() as NonNullable<CaseOperations["payout"]>["mode"],
      } : null,
    }];
  }));
  return cases.map((item) => ({ ...item, operations: byCase.get(item.case_id) ?? { allocation: null, funding: { captured: 0, donations: 0 }, payout: null } }));
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
  return entries.sort((a, b) => a.at.localeCompare(b.at));
}
