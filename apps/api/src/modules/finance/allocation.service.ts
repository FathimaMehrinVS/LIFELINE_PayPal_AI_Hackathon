import type { ApproveAllocationRequest, AllocationResult } from "@lifeline/contracts";
import { Prisma } from "../../generated/prisma/client";
import { getPrisma } from "../../database/prisma";
import { getDemoRouteCatalogue } from "./route-catalogue";
import { assessFees } from "../../rules/fees";
import { incidentReportsPaymentDetailsConflict } from "./supplier-risk";
import { HttpError } from "../../utils/http-error";

type Database = ReturnType<typeof getPrisma>;

function isUniqueConflict(error: unknown): boolean {
  return !!error && typeof error === "object" && (error as { code?: unknown }).code === "P2002";
}

function isSerializationConflict(error: unknown): boolean {
  return !!error && typeof error === "object" && (error as { code?: unknown }).code === "P2034";
}

function toResult(allocation: {
  id: string;
  requestId: string;
  status: string;
  amount: Prisma.Decimal;
  currency: string;
  approvedAt: Date | null;
  purchaseOrder?: { id: string } | null;
}): AllocationResult {
  return {
    allocation_id: allocation.id,
    ...(allocation.purchaseOrder ? { purchase_order_id: allocation.purchaseOrder.id } : {}),
    case_id: allocation.requestId,
    status: allocation.status.toLowerCase() as AllocationResult["status"],
    amount: allocation.amount.toNumber(),
    currency: allocation.currency,
    approved_at: allocation.approvedAt?.toISOString() ?? null,
  };
}

function planCost(assistance: {
  situation: { budget: Prisma.Decimal | null; currency: string | null } | null;
  financial: { recommendedRouteId: string | null; routes: Prisma.JsonValue } | null;
  basket: { total: Prisma.Decimal; currency: string; items: unknown[] } | null;
}) {
  if (!assistance.situation || !assistance.basket || assistance.basket.items.length === 0) {
    throw new HttpError("VALIDATION_ERROR", "Assistance case does not have a costed basket ready for approval");
  }
  if (!assistance.financial?.recommendedRouteId) {
    throw new HttpError("VALIDATION_ERROR", "Assistance case has no recommended delivery route");
  }
  const assessments = Array.isArray(assistance.financial.routes) ? assistance.financial.routes : [];
  const recommendation = assessments.find((row) =>
    !!row && typeof row === "object" && !Array.isArray(row) &&
    "route_id" in row && row.route_id === assistance.financial!.recommendedRouteId,
  );
  if (!recommendation || typeof recommendation !== "object" || Array.isArray(recommendation) || !("verdict" in recommendation) || recommendation.verdict !== "pass") {
    throw new HttpError("VALIDATION_ERROR", "The recommended route is no longer eligible for approval");
  }

  const route = getDemoRouteCatalogue(true).find((candidate) => candidate.id === assistance.financial!.recommendedRouteId);
  if (!route) throw new HttpError("VALIDATION_ERROR", "The recommended route is no longer available");
  const fee = new Prisma.Decimal(assessFees(assistance.basket.total.toNumber(), route).estimated_fee);
  const amount = assistance.basket.total.plus(fee).toDecimalPlaces(2);
  if (!assistance.situation.currency || !assistance.situation.budget || assistance.basket.currency !== assistance.situation.currency ||
      amount.lessThanOrEqualTo(0) || amount.greaterThan(assistance.situation.budget)) {
    throw new HttpError("VALIDATION_ERROR", "The basket cost and route fee do not fit the assistance case budget and currency");
  }
  return { amount, currency: assistance.basket.currency };
}

async function ensurePurchaseOrder(
  tx: Prisma.TransactionClient,
  allocation: { id: string; amount: Prisma.Decimal; currency: string; purchaseOrder: { id: string; merchantId: string } | null },
  merchantId: string,
  actorId: string,
  caseId: string,
) {
  if (allocation.purchaseOrder) {
    if (allocation.purchaseOrder.merchantId !== merchantId) {
      throw new HttpError("VALIDATION_ERROR", "This plan already has a purchase order for a different supplier");
    }
    return allocation.purchaseOrder;
  }
  const order = await tx.purchaseOrder.create({
    data: {
      allocationId: allocation.id,
      merchantId,
      amount: allocation.amount,
      currency: allocation.currency,
      fulfilmentStatus: "AWAITING_ACCEPTANCE",
    },
    select: { id: true, merchantId: true },
  });
  await tx.fulfilmentEvent.create({
    data: { purchaseOrderId: order.id, status: "AWAITING_ACCEPTANCE", actorId, note: "Created with NGO approval" },
  });
  await tx.auditLog.create({
    data: {
      actorId,
      action: "purchase_order.created",
      entityType: "PurchaseOrder",
      entityId: order.id,
      details: { case_id: caseId, allocation_id: allocation.id, merchant_id: merchantId, status: "AWAITING_ACCEPTANCE" },
    },
  });
  return order;
}

/**
 * Approves a costed plan for an approved supplier. The amount is derived from Basket.total plus the selected route's
 * fee on that total, and the allocation, purchase order, case status and audit records commit together.
 */
export async function approveAllocation(
  input: ApproveAllocationRequest,
  actorId: string,
  getDatabase: typeof getPrisma = getPrisma,
): Promise<AllocationResult> {
  const db = getDatabase();

  try {
    return await db.$transaction(async (tx) => {
      const assistance = await tx.assistanceRequest.findUnique({
        where: { id: input.case_id },
        include: {
          situation: true,
          financial: true,
          basket: { include: { items: true } },
          allocation: { include: { purchaseOrder: { select: { id: true, merchantId: true } } } },
        },
      });
      if (!assistance) throw new HttpError("NOT_FOUND", "Assistance case not found");
      const existing = assistance.allocation;
      const alreadyApproved = assistance.status === "APPROVED" &&
        (existing?.status === "APPROVED" || existing?.status === "DISBURSED");
      if ((assistance.status !== "AWAITING_APPROVAL" && !alreadyApproved) || !assistance.situation || !assistance.basket) {
        throw new HttpError("VALIDATION_ERROR", "Assistance case is not ready for NGO approval");
      }
      const { amount, currency } = planCost(assistance);

      const [campaign, merchant] = await Promise.all([
        tx.campaign.findUnique({ where: { id: input.campaign_id } }),
        tx.merchant.findUnique({ where: { id: input.merchant_id }, select: { id: true, status: true } }),
      ]);
      if (!campaign?.active) throw new HttpError("NOT_FOUND", "Active campaign not found");
      if (campaign.currency !== currency) throw new HttpError("VALIDATION_ERROR", "Plan currency must match the campaign currency");
      if (!merchant) throw new HttpError("NOT_FOUND", "Supplier not found");
      if (merchant.status !== "APPROVED") throw new HttpError("VALIDATION_ERROR", "Only an approved supplier can receive a purchase order");
      const supplierIncidents = await tx.supplierIncident.findMany({
        where: { merchantId: merchant.id, status: "OPEN" },
        select: { description: true },
      });
      if (supplierIncidents.some((incident) => incidentReportsPaymentDetailsConflict(incident.description))) {
        throw new HttpError("VALIDATION_ERROR", "Approval is on hold because the supplier has a reported payment-details conflict");
      }

      if (existing?.status === "APPROVED" || existing?.status === "DISBURSED") {
        if (existing.campaignId !== campaign.id || existing.currency !== currency || !new Prisma.Decimal(existing.amount).equals(amount)) {
          throw new HttpError("VALIDATION_ERROR", "This case already has an allocation with different cost or campaign details");
        }
        const purchaseOrder = await ensurePurchaseOrder(tx, existing, merchant.id, actorId, assistance.id);
        if (assistance.status !== "APPROVED") {
          await tx.assistanceRequest.update({ where: { id: assistance.id }, data: { status: "APPROVED" } });
        }
        return toResult({ ...existing, purchaseOrder });
      }
      if (existing?.status === "REJECTED" || existing?.status === "COMPLETED") {
        throw new HttpError("VALIDATION_ERROR", "A rejected or completed allocation cannot be approved");
      }

      const approvedAt = new Date();
      const allocation = existing
        ? await tx.aidAllocation.update({
            where: { id: existing.id },
            data: { campaignId: campaign.id, amount, currency, status: "APPROVED", approvedAt },
            include: { purchaseOrder: { select: { id: true, merchantId: true } } },
          })
        : await tx.aidAllocation.create({
            data: {
              requestId: assistance.id,
              campaignId: campaign.id,
              amount,
              currency,
              status: "APPROVED",
              approvedAt,
            },
            include: { purchaseOrder: { select: { id: true, merchantId: true } } },
          });

      await tx.assistanceRequest.update({ where: { id: assistance.id }, data: { status: "APPROVED" } });
      const purchaseOrder = await ensurePurchaseOrder(tx, allocation, merchant.id, actorId, assistance.id);
      await tx.auditLog.create({
        data: {
          actorId,
          action: "allocation.approved",
          entityType: "AidAllocation",
          entityId: allocation.id,
          details: { case_id: assistance.id, campaign_id: campaign.id, purchase_order_id: purchaseOrder.id, merchant_id: merchant.id, amount: amount.toString(), currency },
        },
      });
      return toResult({ ...allocation, purchaseOrder });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  } catch (error) {
    if (error instanceof HttpError) throw error;
    if (isUniqueConflict(error)) {
      const existing = await db.aidAllocation.findUnique({ where: { requestId: input.case_id }, include: { purchaseOrder: { select: { id: true, merchantId: true } } } });
      if (existing?.status === "APPROVED" && existing.purchaseOrder?.merchantId === input.merchant_id) return toResult(existing);
      throw new HttpError("VALIDATION_ERROR", "An allocation already exists for this case");
    }
    if (isSerializationConflict(error)) {
      throw new HttpError("VALIDATION_ERROR", "Campaign funds changed during approval; please review and try again");
    }
    throw error;
  }
}
