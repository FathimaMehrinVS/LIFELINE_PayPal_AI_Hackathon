import type { AuditRecords, Ledger } from "@lifeline/contracts";
import type { getPrisma } from "../../database/prisma";
import { CASE_AUDIT_ACTION } from "../../orchestration/case-store";
import { roundMoney } from "../../utils/money";
import { DEMO_HISTORY_PREFIX, planReference } from "../plans/plan.service";

// Owner: Member 1. NGO views of what was recorded. Donor money in and supplier money out stay separate.

type Database = ReturnType<typeof getPrisma>;

const REAL_ALLOCATION = { not: { startsWith: DEMO_HISTORY_PREFIX } };
const shortRef = (prefix: string, id: string) => `${prefix}-${id.slice(-6).toUpperCase()}`;

export async function getLedger(db: Database, limit = 100): Promise<Ledger> {
  const [captured, allocated, payoutTotals, donations, payouts] = await Promise.all([
    db.donation.groupBy({ by: ["currency"], where: { status: "CAPTURED" }, _sum: { amount: true } }),
    db.aidAllocation.groupBy({ by: ["currency"], where: { id: REAL_ALLOCATION, status: { in: ["APPROVED", "DISBURSED"] } }, _sum: { amount: true } }),
    db.payout.groupBy({ by: ["currency", "mode"], where: { allocationId: REAL_ALLOCATION, status: "COMPLETED" }, _sum: { amount: true } }),
    db.donation.findMany({ orderBy: { updatedAt: "desc" }, take: limit, select: { id: true, donorId: true, allocationId: true, amount: true, currency: true, status: true, paypalCaptureId: true, updatedAt: true, allocation: { select: { requestId: true } } } }),
    db.payout.findMany({ where: { allocationId: REAL_ALLOCATION }, orderBy: { createdAt: "desc" }, take: limit, select: { id: true, allocationId: true, purchaseOrderId: true, amount: true, currency: true, status: true, mode: true, reference: true, createdAt: true, purchaseOrder: { select: { merchant: { select: { name: true } } } } } }),
  ]);

  const currencies = [...new Set([...captured, ...allocated, ...payoutTotals].map((row) => row.currency))].sort();
  const sum = (rows: { currency: string; _sum: { amount: { toNumber(): number } | null } }[], currency: string) =>
    roundMoney(rows.filter((row) => row.currency === currency).reduce((total, row) => total + (row._sum.amount?.toNumber() ?? 0), 0));

  return {
    totals: currencies.map((currency) => {
      const received = sum(captured, currency);
      const paid = sum(payoutTotals.filter((row) => row.mode !== "SIMULATED"), currency);
      return { currency, captured: received, allocated: sum(allocated, currency), paid, simulated: sum(payoutTotals.filter((row) => row.mode === "SIMULATED"), currency), balance: roundMoney(received - paid) };
    }),
    donations: donations.map((donation) => ({
      id: donation.id,
      reference: shortRef("DN", donation.id),
      donor: donation.donorId ? `Donor ${donation.donorId.slice(-4).toUpperCase()}` : "Anonymous",
      plan_reference: donation.allocationId ? planReference(donation.allocationId) : null,
      case_id: donation.allocation?.requestId ?? null,
      amount: donation.amount.toNumber(),
      currency: donation.currency,
      status: donation.status.toLowerCase() as Ledger["donations"][number]["status"],
      paypal_capture_id: donation.paypalCaptureId,
      updated_at: donation.updatedAt.toISOString(),
    })),
    payouts: payouts.map((payout) => ({
      id: payout.id,
      reference: shortRef("SP", payout.id),
      plan_reference: planReference(payout.allocationId),
      purchase_order_id: payout.purchaseOrderId,
      supplier: payout.purchaseOrder?.merchant.name ?? null,
      amount: payout.amount.toNumber(),
      currency: payout.currency,
      mode: payout.mode.toLowerCase() as Ledger["payouts"][number]["mode"],
      status: payout.status.toLowerCase() as Ledger["payouts"][number]["status"],
      payment_reference: payout.reference,
      created_at: payout.createdAt.toISOString(),
    })),
  };
}

const AUDIT_LABELS: Record<string, { title: string; category: AuditRecords["entries"][number]["category"] }> = {
  [CASE_AUDIT_ACTION]: { title: "Case recorded", category: "case" },
  "allocation.approved": { title: "Plan approved", category: "approval" },
  "allocation.disbursement_simulated": { title: "Simulated disbursement recorded", category: "payment" },
  "supplier.registered": { title: "Supplier registered", category: "supplier" },
  "supplier.status_changed": { title: "Supplier status changed", category: "supplier" },
  "supplier.check_recorded": { title: "Supplier check recorded", category: "supplier" },
  "user.role_changed": { title: "Access changed", category: "other" },
  "user.role_updated": { title: "Access changed by Admin", category: "other" },
};

const asText = (value: unknown) => (typeof value === "string" && value ? value : null);

export async function getAuditRecords(db: Database, limit = 100): Promise<AuditRecords> {
  const [logs, incidents] = await Promise.all([
    db.auditLog.findMany({ where: { NOT: { entityId: { startsWith: DEMO_HISTORY_PREFIX } } }, orderBy: { createdAt: "desc" }, take: limit, include: { actor: { select: { name: true } } } }),
    db.supplierIncident.findMany({ orderBy: { createdAt: "desc" }, take: limit, include: { merchant: { select: { name: true } } } }),
  ]);
  const supplierIds = [...new Set(logs.filter((log) => log.entityType === "Merchant").map((log) => log.entityId))];
  const suppliers = supplierIds.length ? await db.merchant.findMany({ where: { id: { in: supplierIds } }, select: { id: true, name: true } }) : [];
  const supplierName = new Map(suppliers.map((supplier) => [supplier.id, supplier.name]));

  return {
    // Case records store the full assessment in `details`. Only named fields are read, so it never reaches this page.
    entries: logs.map((log) => {
      const details = (log.action === CASE_AUDIT_ACTION ? {} : log.details ?? {}) as Record<string, unknown>;
      const label = AUDIT_LABELS[log.action] ?? { title: capitaliseAction(log.action), category: "other" as const };
      const caseId = log.entityId.startsWith("case_") ? log.entityId : asText(details.case_id);
      const subject = supplierName.get(log.entityId) ?? (caseId ? `LL-${caseId.slice(5, 13).toUpperCase()}` : log.entityType === "AidAllocation" ? planReference(log.entityId) : null);
      const amount = asText(details.amount);
      return {
        id: log.id,
        action: log.action,
        title: label.title,
        category: label.category,
        actor: log.actor?.name ?? "System",
        subject,
        from: asText(details.from),
        to: asText(details.to),
        note: asText(details.label) ? [asText(details.label), asText(details.reason)].filter(Boolean).join(": ") : asText(details.reason) ?? (amount ? `${amount} ${asText(details.currency) ?? ""}`.trim() : null),
        at: log.createdAt.toISOString(),
      };
    }),
    incidents: incidents.map((incident) => ({
      id: incident.id,
      supplier: incident.merchant.name,
      severity: incident.severity.toLowerCase() as AuditRecords["incidents"][number]["severity"],
      status: incident.status.toLowerCase() as AuditRecords["incidents"][number]["status"],
      description: incident.description,
      purchase_order_id: incident.purchaseOrderId,
      created_at: incident.createdAt.toISOString(),
      resolved_at: incident.resolvedAt?.toISOString() ?? null,
    })),
  };
}

function capitaliseAction(action: string): string {
  const text = action.replaceAll(/[._]/g, " ");
  return text.charAt(0).toUpperCase() + text.slice(1);
}
