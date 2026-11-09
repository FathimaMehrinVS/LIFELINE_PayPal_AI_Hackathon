import type { CreateSupplierRequest, Supplier, SupplierDetail, SupplierHistoryEntry, SupplierStatus, UpdateSupplierStatusRequest } from "@lifeline/contracts";
import { getPrisma } from "../../database/prisma";
import type { SupplierStatus as DbSupplierStatus } from "../../generated/prisma/client";
import { canReceiveOrders, supplierScorecard } from "../../rules/supplier-score";
import { HttpError } from "../../utils/http-error";

// Owner: Member 1. The supplier registry. Merchant is the supplier table; every decision is written to AuditLog.

type Database = ReturnType<typeof getPrisma>;
const ENTITY = "Merchant";
const STATUS_CHANGED = "supplier.status_changed";

const toStatus = (status: DbSupplierStatus) => status.toLowerCase() as SupplierStatus;
const toDbStatus = (status: SupplierStatus) => status.toUpperCase() as DbSupplierStatus;

const SUPPLIER_INCLUDE = {
  purchaseOrders: { select: { fulfilmentStatus: true } },
  incidents: { select: { status: true } },
} as const;

type SupplierRow = {
  id: string; name: string; location: string; serviceAreas: string[]; categories: string[]; accepts: string[];
  contact: string | null; status: DbSupplierStatus; createdAt: Date;
  purchaseOrders: { fulfilmentStatus: string }[];
  incidents: { status: string }[];
};

function toSupplier(row: SupplierRow, statusChangedAt: Date | null): Supplier {
  return {
    supplier_id: row.id,
    name: row.name,
    location: row.location,
    service_areas: row.serviceAreas,
    categories: row.categories,
    accepts: row.accepts,
    contact: row.contact,
    status: toStatus(row.status),
    created_at: row.createdAt.toISOString(),
    status_changed_at: statusChangedAt?.toISOString() ?? null,
    scorecard: supplierScorecard({
      completed: row.purchaseOrders.filter((order) => order.fulfilmentStatus === "RECIPIENT_CONFIRMED").length,
      issues: row.purchaseOrders.filter((order) => order.fulfilmentStatus === "ISSUE_REPORTED").length,
      openComplaints: row.incidents.filter((incident) => incident.status === "OPEN").length,
    }),
  };
}

export async function listSuppliers(db: Database): Promise<Supplier[]> {
  const rows = await db.merchant.findMany({ include: SUPPLIER_INCLUDE, orderBy: { name: "asc" } });
  const changes = await db.auditLog.findMany({
    where: { action: STATUS_CHANGED, entityType: ENTITY, entityId: { in: rows.map((row) => row.id) } },
    orderBy: { createdAt: "desc" },
    select: { entityId: true, createdAt: true },
  });
  const latest = new Map<string, Date>();
  for (const change of changes) if (!latest.has(change.entityId)) latest.set(change.entityId, change.createdAt);
  return rows.map((row) => toSupplier(row, latest.get(row.id) ?? null));
}

export async function getSupplier(db: Database, id: string): Promise<SupplierDetail> {
  const row = await db.merchant.findUnique({
    where: { id },
    include: { ...SUPPLIER_INCLUDE, incidents: { orderBy: { createdAt: "desc" } } },
  });
  if (!row) throw new HttpError("NOT_FOUND", "Supplier not found");
  const logs = await db.auditLog.findMany({
    where: { entityType: ENTITY, entityId: id, action: { startsWith: "supplier." } },
    orderBy: { createdAt: "desc" },
    include: { actor: { select: { name: true } } },
  });
  const history: SupplierHistoryEntry[] = logs.map((log) => {
    const details = (log.details ?? {}) as { from?: SupplierStatus; to?: SupplierStatus; reason?: string };
    return { action: log.action, from: details.from ?? null, to: details.to ?? null, reason: details.reason ?? null, actor: log.actor?.name ?? null, at: log.createdAt.toISOString() };
  });
  const changed = logs.find((log) => log.action === STATUS_CHANGED);
  return {
    ...toSupplier(row, changed?.createdAt ?? null),
    incidents: row.incidents.map((incident) => ({
      incident_id: incident.id,
      severity: incident.severity.toLowerCase() as "low" | "medium" | "high",
      description: incident.description,
      status: incident.status.toLowerCase() as "open" | "resolved",
      created_at: incident.createdAt.toISOString(),
    })),
    history,
  };
}

/** New suppliers always start pending: registering is never the same as being approved. */
export async function registerSupplier(db: Database, input: CreateSupplierRequest, actorId: string): Promise<SupplierDetail> {
  const created = await db.$transaction(async (tx) => {
    const merchant = await tx.merchant.create({
      data: { name: input.name, location: input.location, serviceAreas: input.service_areas, categories: input.categories, accepts: input.accepts, contact: input.contact ?? null, status: "PENDING" },
    });
    await tx.auditLog.create({ data: { action: "supplier.registered", entityType: ENTITY, entityId: merchant.id, actorId, details: { to: "pending" } } });
    return merchant;
  });
  return getSupplier(db, created.id);
}

export async function updateSupplierStatus(db: Database, id: string, input: UpdateSupplierStatusRequest, actorId: string): Promise<SupplierDetail> {
  await db.$transaction(async (tx) => {
    const merchant = await tx.merchant.findUnique({ where: { id }, select: { status: true } });
    if (!merchant) throw new HttpError("NOT_FOUND", "Supplier not found");
    const from = toStatus(merchant.status);
    if (from === input.status) throw new HttpError("VALIDATION_ERROR", `This supplier is already ${input.status}`);
    await tx.merchant.update({ where: { id }, data: { status: toDbStatus(input.status) } });
    await tx.auditLog.create({ data: { action: STATUS_CHANGED, entityType: ENTITY, entityId: id, actorId, details: { from, to: input.status, reason: input.reason } } });
  });
  return getSupplier(db, id);
}

/** For purchase orders: call inside the transaction that creates the order. */
export async function requireApprovedSupplier(db: Pick<Database, "merchant">, id: string): Promise<void> {
  const merchant = await db.merchant.findUnique({ where: { id }, select: { status: true } });
  if (!merchant) throw new HttpError("NOT_FOUND", "Supplier not found");
  if (!canReceiveOrders(toStatus(merchant.status))) throw new HttpError("VALIDATION_ERROR", "Only an approved supplier can receive a purchase order");
}
