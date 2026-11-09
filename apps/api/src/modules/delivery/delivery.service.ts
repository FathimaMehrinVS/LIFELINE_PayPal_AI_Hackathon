import type { AssignDeliveryRequest, DeliveryPartner, DeliveryRecord, SubmitDeliveryEventRequest, VerifyDeliveryRequest } from "@lifeline/contracts";
import { Prisma } from "../../generated/prisma/client";
import { getPrisma } from "../../database/prisma";
import { HttpError } from "../../utils/http-error";
import type { AuthSession } from "../../auth/session";
import { canTransitionFulfilment, type FulfilmentStatus } from "../../rules/fulfilment";
import { createPickupCode, MAX_PICKUP_CODE_ATTEMPTS, verifyPickupCode } from "../procurement/pickup-code";

type Database = ReturnType<typeof getPrisma>;
type Transaction = Prisma.TransactionClient;

const allocationInclude = {
  request: { include: { basket: { include: { items: true } } } },
  donations: { where: { status: "CAPTURED" }, select: { amount: true } },
  purchaseOrder: {
    include: {
      merchant: { select: { id: true, name: true } },
      partnerUser: { select: { id: true, name: true, email: true } },
      events: { orderBy: { createdAt: "asc" as const } },
    },
  },
} satisfies Prisma.AidAllocationInclude;

const purchaseOrderInclude = {
  merchant: { select: { id: true, name: true } },
  partnerUser: { select: { id: true, name: true, email: true } },
  events: { orderBy: { createdAt: "asc" as const } },
} satisfies Prisma.PurchaseOrderInclude;

function deliveredItems(value: Prisma.JsonValue | null): DeliveryRecord["events"][number]["delivered_items"] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) return [];
    const row = item as Record<string, Prisma.JsonValue>;
    if (typeof row.basket_item_id !== "string" || typeof row.name !== "string" || typeof row.quantity !== "number") return [];
    return [{ basket_item_id: row.basket_item_id, name: row.name, quantity: row.quantity }];
  });
}

function toRecord(allocation: any): DeliveryRecord {
  const order = allocation.purchaseOrder;
  return {
    allocation_id: allocation.id,
    purchase_order_id: order?.id ?? null,
    case_id: allocation.requestId,
    allocation_status: allocation.status.toLowerCase(),
    amount: allocation.amount.toNumber(),
    currency: allocation.currency,
    captured_amount: allocation.donations.reduce((sum: Prisma.Decimal, donation: { amount: Prisma.Decimal }) => sum.plus(donation.amount), new Prisma.Decimal(0)).toNumber(),
    fulfilment_status: order ? order.fulfilmentStatus.toLowerCase() : null,
    merchant: order?.merchant ? { merchant_id: order.merchant.id, name: order.merchant.name } : null,
    partner: order?.partnerUser ? { user_id: order.partnerUser.id, name: order.partnerUser.name, email: order.partnerUser.email } : null,
    expected_items: (allocation.request.basket?.items ?? []).map((item: { id: string; name: string; quantity: number }) => ({ basket_item_id: item.id, name: item.name, quantity: item.quantity })),
    events: (order?.events ?? []).map((event: { status: string; actorId: string | null; note: string | null; evidenceType: string | null; deliveredItems: Prisma.JsonValue | null; createdAt: Date }) => ({
      status: event.status.toLowerCase(),
      actor_id: event.actorId,
      note: event.note,
      evidence_type: event.evidenceType?.toLowerCase() ?? null,
      delivered_items: deliveredItems(event.deliveredItems),
      at: event.createdAt.toISOString(),
    })),
  };
}

function ensureFunding(allocation: { amount: Prisma.Decimal; currency: string }, capturedAmount: Prisma.Decimal | null) {
  if (!capturedAmount || capturedAmount.lessThan(allocation.amount)) {
    throw new HttpError("VALIDATION_ERROR", "Captured donations do not yet cover this allocation", {
      captured: capturedAmount?.toNumber() ?? 0, required: allocation.amount.toNumber(), currency: allocation.currency,
    });
  }
}

export async function listDeliveryAllocations(db: Database): Promise<DeliveryRecord[]> {
  const rows = await db.aidAllocation.findMany({
    where: { status: { in: ["APPROVED", "DISBURSED", "COMPLETED"] } },
    include: allocationInclude,
    orderBy: { approvedAt: "desc" },
  });
  return rows.map(toRecord);
}

export async function listAssignedDeliveries(db: Database, partnerUserId: string): Promise<DeliveryRecord[]> {
  const orders = await db.purchaseOrder.findMany({
    where: { partnerUserId },
    include: { ...purchaseOrderInclude, allocation: { include: allocationInclude } },
    orderBy: { createdAt: "desc" },
  });
  return orders.map((order) => toRecord({ ...order.allocation, purchaseOrder: order }));
}

export async function listDeliveryPartners(db: Database): Promise<DeliveryPartner[]> {
  const users = await db.user.findMany({ where: { role: "PARTNER" }, select: { id: true, name: true, email: true }, orderBy: { name: "asc" } });
  return users.map((user) => ({ user_id: user.id, name: user.name, email: user.email }));
}

export async function getDeliveryRecord(db: Database, allocationId: string, session: AuthSession): Promise<DeliveryRecord> {
  const allocation = await db.aidAllocation.findUnique({ where: { id: allocationId }, include: allocationInclude });
  if (!allocation) throw new HttpError("NOT_FOUND", "Assistance allocation not found");
  if (session.role !== "NGO" && allocation.purchaseOrder?.partnerUserId !== session.id) {
    throw new HttpError("NOT_FOUND", "Delivery record not found");
  }
  return toRecord(allocation);
}

export async function assignDelivery(
  input: AssignDeliveryRequest,
  actor: AuthSession,
  getDatabase: typeof getPrisma = getPrisma,
): Promise<{ record: DeliveryRecord; duplicate: boolean }> {
  const db = getDatabase();
  const result = await db.$transaction(async (tx) => {
    const allocation = await tx.aidAllocation.findUnique({ where: { id: input.allocation_id }, include: allocationInclude });
    if (!allocation) throw new HttpError("NOT_FOUND", "Assistance allocation not found");
    if (!["APPROVED", "DISBURSED"].includes(allocation.status) || allocation.request.status !== "APPROVED") {
      throw new HttpError("VALIDATION_ERROR", "Delivery can only be assigned to an approved allocation and case");
    }
    if (!allocation.request.basket?.items.length) throw new HttpError("VALIDATION_ERROR", "This approved case has no basket items to deliver");
    const [partner, merchant, captured] = await Promise.all([
      tx.user.findUnique({ where: { id: input.partner_user_id }, select: { id: true, name: true, email: true, role: true } }),
      tx.merchant.findUnique({ where: { id: input.merchant_id }, select: { id: true, name: true, status: true, verified: true } }),
      tx.donation.aggregate({ where: { allocationId: allocation.id, status: "CAPTURED", currency: allocation.currency }, _sum: { amount: true } }),
    ]);
    if (!partner || partner.role !== "PARTNER") throw new HttpError("VALIDATION_ERROR", "Choose an existing PARTNER profile");
    if (!merchant || merchant.status !== "APPROVED" || !merchant.verified) throw new HttpError("VALIDATION_ERROR", "Choose an approved, verified supplier");
    ensureFunding(allocation, captured._sum.amount);

    const existing = await tx.purchaseOrder.findUnique({ where: { allocationId: allocation.id }, include: purchaseOrderInclude });
    if (existing) {
      if (existing.merchantId === merchant.id && existing.partnerUserId === partner.id) {
        return { record: toRecord({ ...allocation, purchaseOrder: existing }), duplicate: true };
      }
      throw new HttpError("VALIDATION_ERROR", "A different delivery assignment already exists for this allocation");
    }

    const purchaseOrder = await tx.purchaseOrder.create({
      data: { allocationId: allocation.id, merchantId: merchant.id, partnerUserId: partner.id, amount: allocation.amount, currency: allocation.currency },
      include: purchaseOrderInclude,
    });
    await tx.auditLog.create({ data: {
      actorId: actor.id,
      action: "delivery.assigned",
      entityType: "AidAllocation",
      entityId: allocation.id,
      details: { case_id: allocation.requestId, partner_user_id: partner.id, merchant_id: merchant.id, purchase_order_id: purchaseOrder.id },
    } });
    return { record: toRecord({ ...allocation, purchaseOrder }), duplicate: false };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  return result;
}

export async function submitDeliveryEvent(
  allocationId: string,
  input: SubmitDeliveryEventRequest,
  actor: AuthSession,
  getDatabase: typeof getPrisma = getPrisma,
): Promise<DeliveryRecord> {
  if (actor.role !== "PARTNER") throw new HttpError("FORBIDDEN", "Only the assigned partner can submit delivery updates");
  const db = getDatabase();
  return db.$transaction(async (tx) => {
    const allocation = await tx.aidAllocation.findUnique({ where: { id: allocationId }, include: allocationInclude });
    if (!allocation) throw new HttpError("NOT_FOUND", "Assistance allocation not found");
    const order = allocation.purchaseOrder;
    if (!order || order.partnerUserId !== actor.id) throw new HttpError("NOT_FOUND", "Delivery assignment not found");
    if (allocation.status === "COMPLETED") throw new HttpError("VALIDATION_ERROR", "Completed assistance cannot receive more delivery updates");

    const requestedStatus = input.status.toUpperCase() as FulfilmentStatus;
    if (!canTransitionFulfilment(order.fulfilmentStatus as FulfilmentStatus, requestedStatus, "SUPPLIER")) {
      throw new HttpError("VALIDATION_ERROR", `Delivery cannot transition from ${order.fulfilmentStatus} to ${requestedStatus}`);
    }
    if (requestedStatus === "ISSUE_REPORTED" && !input.note?.trim()) {
      throw new HttpError("VALIDATION_ERROR", "A short note is required when reporting a delivery issue");
    }

    let savedItems: { basket_item_id: string; name: string; quantity: number }[] = [];
    if (requestedStatus === "HANDED_OVER") {
      const submitted = input.delivered_items ?? [];
      if (!input.delivered_items || submitted.length === 0) {
        throw new HttpError("VALIDATION_ERROR", "Handover must list the delivered basket items and quantities");
      }
      const basketItems = allocation.request.basket?.items ?? [];
      const seen = new Set<string>();
      for (const line of submitted) {
        const expected = basketItems.find((item) => item.id === line.basket_item_id);
        if (!expected || seen.has(line.basket_item_id) || line.quantity > expected.quantity) {
          throw new HttpError("VALIDATION_ERROR", "Handover items must match this case basket and cannot exceed planned quantities");
        }
        seen.add(line.basket_item_id);
        savedItems.push({ basket_item_id: expected.id, name: expected.name, quantity: line.quantity });
      }
    } else if (input.delivered_items?.length) {
      throw new HttpError("VALIDATION_ERROR", "Delivered items can only be recorded with the handover");
    }

    const pickupCode = requestedStatus === "READY" ? createPickupCode() : null;
    const changed = await tx.purchaseOrder.updateMany({
      where: { id: order.id, fulfilmentStatus: order.fulfilmentStatus },
      data: {
        fulfilmentStatus: requestedStatus,
        ...(pickupCode ? { pickupCodeHash: pickupCode.hash, pickupAttempts: 0 } : {}),
      },
    });
    if (changed.count !== 1) throw new HttpError("VALIDATION_ERROR", "Delivery state changed; reload and try again");
    await tx.fulfilmentEvent.create({ data: {
      purchaseOrderId: order.id,
      status: requestedStatus,
      actorId: actor.id,
      evidenceType: requestedStatus === "HANDED_OVER" ? "SUPPLIER_CONFIRMATION" : null,
      note: input.note || null,
      deliveredItems: requestedStatus === "HANDED_OVER" ? savedItems as Prisma.InputJsonValue : Prisma.DbNull,
    } });
    await tx.auditLog.create({ data: {
      actorId: actor.id,
      action: requestedStatus === "HANDED_OVER" ? "delivery.handover_recorded" : "delivery.status_changed",
      entityType: "AidAllocation",
      entityId: allocation.id,
      details: { case_id: allocation.requestId, purchase_order_id: order.id, from: order.fulfilmentStatus, to: requestedStatus, delivered_items: savedItems },
    } });
    const updated = await tx.aidAllocation.findUnique({ where: { id: allocation.id }, include: allocationInclude });
    if (!updated) throw new HttpError("NOT_FOUND", "Assistance allocation not found");
    return { ...toRecord(updated), ...(pickupCode ? { pickup_code: pickupCode.code } : {}) };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

export async function verifyDelivery(
  allocationId: string,
  input: VerifyDeliveryRequest,
  actor: AuthSession,
  getDatabase: typeof getPrisma = getPrisma,
): Promise<{ record: DeliveryRecord; duplicate: boolean }> {
  if (actor.role !== "NGO") throw new HttpError("FORBIDDEN", "Only an NGO can verify delivery");
  const db = getDatabase();
  const outcome = await db.$transaction(async (tx) => {
    const allocation = await tx.aidAllocation.findUnique({ where: { id: allocationId }, include: allocationInclude });
    if (!allocation) throw new HttpError("NOT_FOUND", "Assistance allocation not found");
    if (allocation.status === "COMPLETED" && allocation.purchaseOrder?.fulfilmentStatus === "RECIPIENT_CONFIRMED") {
      return { record: toRecord(allocation), duplicate: true };
    }
    const order = allocation.purchaseOrder;
    if (!order || allocation.request.status !== "APPROVED" || order.fulfilmentStatus !== "HANDED_OVER") {
      throw new HttpError("VALIDATION_ERROR", "Only a handed-over delivery for an approved case can be verified");
    }
    if (!order.pickupCodeHash) throw new HttpError("VALIDATION_ERROR", "No active pickup code is available for this order");
    if (order.pickupAttempts >= MAX_PICKUP_CODE_ATTEMPTS) {
      await tx.auditLog.create({ data: {
        actorId: actor.id, action: "purchase_order.pickup_code_locked", entityType: "PurchaseOrder", entityId: order.id,
        details: { allocation_id: allocation.id, attempts: order.pickupAttempts },
      } });
      return { failure: "locked" as const, attempts: order.pickupAttempts };
    }
    if (!verifyPickupCode(input.pickup_code, order.pickupCodeHash)) {
      const attempt = order.pickupAttempts + 1;
      const incremented = await tx.purchaseOrder.updateMany({
        where: { id: order.id, fulfilmentStatus: "HANDED_OVER", pickupAttempts: order.pickupAttempts },
        data: { pickupAttempts: { increment: 1 } },
      });
      if (incremented.count !== 1) throw new HttpError("VALIDATION_ERROR", "Pickup verification changed; please try again");
      await tx.auditLog.create({ data: {
        actorId: actor.id, action: "purchase_order.pickup_code_rejected", entityType: "PurchaseOrder", entityId: order.id,
        details: { allocation_id: allocation.id, attempts: attempt },
      } });
      return { failure: "invalid" as const, attempts: attempt };
    }
    const handover = [...order.events].reverse().find((event) => event.status === "HANDED_OVER");
    if (!handover || deliveredItems(handover.deliveredItems).length === 0) {
      throw new HttpError("VALIDATION_ERROR", "The partner handover has no delivered-item record to verify");
    }
    const plannedItems = allocation.request.basket?.items ?? [];
    const handedOverItems = deliveredItems(handover.deliveredItems);
    const handedOverQuantities = new Map(handedOverItems.map((item) => [item.basket_item_id, item.quantity]));
    const shortfalls = plannedItems.flatMap((item) => {
      const delivered = handedOverQuantities.get(item.id) ?? 0;
      return delivered < item.quantity
        ? [{ basket_item_id: item.id, name: item.name, planned_quantity: item.quantity, delivered_quantity: delivered }]
        : [];
    });
    if (shortfalls.length > 0 && !(input.accept_shortfall === true && input.shortfall_reason)) {
      throw new HttpError("VALIDATION_ERROR", "Delivery quantities are incomplete; provide explicit NGO acceptance and a reason for the shortfall", { shortfalls });
    }
    if (shortfalls.length === 0 && (input.accept_shortfall || input.shortfall_reason)) {
      throw new HttpError("VALIDATION_ERROR", "A shortfall can only be accepted when planned delivery quantities are missing");
    }
    ensureFunding(allocation, allocation.donations.reduce((sum, donation) => sum.plus(donation.amount), new Prisma.Decimal(0)));
    if (!["APPROVED", "DISBURSED"].includes(allocation.status)) {
      throw new HttpError("VALIDATION_ERROR", "This allocation cannot be completed from its current status");
    }
    if (!canTransitionFulfilment("HANDED_OVER", "RECIPIENT_CONFIRMED", "NGO", { pickupCodeVerified: true })) {
      throw new HttpError("VALIDATION_ERROR", "Delivery confirmation is not an allowed status change");
    }
    const orderChanged = await tx.purchaseOrder.updateMany({
      where: { id: order.id, fulfilmentStatus: "HANDED_OVER", pickupCodeHash: order.pickupCodeHash },
      data: { fulfilmentStatus: "RECIPIENT_CONFIRMED", pickupCodeHash: null },
    });
    const allocationChanged = await tx.aidAllocation.updateMany({ where: { id: allocation.id, status: allocation.status }, data: { status: "COMPLETED" } });
    if (orderChanged.count !== 1 || allocationChanged.count !== 1) throw new HttpError("VALIDATION_ERROR", "Delivery state changed; reload and try again");
    const caseChanged = await tx.assistanceRequest.updateMany({ where: { id: allocation.requestId, status: "APPROVED" }, data: { status: "COMPLETED" } });
    if (caseChanged.count !== 1) throw new HttpError("VALIDATION_ERROR", "Assistance case state changed; reload and try again");

    const verificationNote = shortfalls.length > 0
      ? `Shortfall accepted by NGO: ${input.shortfall_reason}${input.note ? `; ${input.note}` : ""}`
      : input.note || null;
    await tx.fulfilmentEvent.create({ data: { purchaseOrderId: order.id, status: "RECIPIENT_CONFIRMED", actorId: actor.id, evidenceType: "PICKUP_CODE", note: verificationNote } });
    await tx.auditLog.createMany({ data: [
      { actorId: actor.id, action: "delivery.recipient_confirmed", entityType: "AidAllocation", entityId: allocation.id, details: { case_id: allocation.requestId, purchase_order_id: order.id, confirmed_by: actor.id, shortfall_accepted: shortfalls.length > 0, shortfall_reason: shortfalls.length > 0 ? input.shortfall_reason : null, shortfalls } },
      { actorId: actor.id, action: "allocation.completed", entityType: "AidAllocation", entityId: allocation.id, details: { case_id: allocation.requestId, purchase_order_id: order.id } },
    ] });
    const updated = await tx.aidAllocation.findUnique({ where: { id: allocation.id }, include: allocationInclude });
    if (!updated) throw new HttpError("NOT_FOUND", "Assistance allocation not found");
    return { record: toRecord(updated), duplicate: false };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  if ("failure" in outcome) {
    const attempts = outcome.attempts;
    if (outcome.failure === "locked") throw new HttpError("VALIDATION_ERROR", "Too many incorrect pickup codes. Ask an NGO worker to help.", { attempts });
    throw new HttpError("VALIDATION_ERROR", "Pickup code is incorrect", { attempts, remaining_attempts: Math.max(0, MAX_PICKUP_CODE_ATTEMPTS - attempts) });
  }
  return outcome;
}
