import type { CreatePayoutRequest, PayoutResult } from "@lifeline/contracts";
import { Prisma } from "../../generated/prisma/client";
import { getPrisma } from "../../database/prisma";
import { HttpError } from "../../utils/http-error";

const SIMULATION_NOTICE = "Simulated supplier payment only. No PayPal payout was sent; no money was transferred to the recipient.";

function toResult(payout: {
  id: string;
  allocationId: string;
  purchaseOrderId: string | null;
  reference: string | null;
  status: string;
  amount: Prisma.Decimal;
  currency: string;
  mode: string;
  paypalBatchId: string | null;
}): PayoutResult {
  if (!payout.purchaseOrderId || !payout.reference) {
    throw new HttpError("INTERNAL_ERROR", "Supplier payment is missing its purchase order or reference");
  }
  return {
    payout_id: payout.id,
    allocation_id: payout.allocationId,
    purchase_order_id: payout.purchaseOrderId,
    reference: payout.reference,
    status: payout.status.toLowerCase() as PayoutResult["status"],
    amount: payout.amount.toNumber(),
    currency: payout.currency,
    mode: payout.mode.toLowerCase() as PayoutResult["mode"],
    ...(payout.paypalBatchId ? { paypal_batch_id: payout.paypalBatchId } : {}),
    ...(payout.mode === "SIMULATED" ? { notice: SIMULATION_NOTICE } : {}),
  };
}

/** Records a separate, unmistakably simulated supplier payment after checking captured campaign funds. */
export async function simulateAllocationDisbursement(
  input: CreatePayoutRequest,
  actorId: string,
  getDatabase: typeof getPrisma = getPrisma,
): Promise<{ result: PayoutResult; duplicate: boolean }> {
  const db = getDatabase();

  return db.$transaction(async (tx) => {
    const order = await tx.purchaseOrder.findUnique({
      where: { id: input.purchase_order_id },
      include: { allocation: { include: { request: true, campaign: true } }, merchant: { select: { status: true } } },
    });
    if (!order) throw new HttpError("NOT_FOUND", "Purchase order not found");
    const allocation = order.allocation;
    const existingPayout = await tx.payout.findFirst({ where: { purchaseOrderId: order.id }, orderBy: { createdAt: "asc" } });

    if (existingPayout) {
      if ((allocation.status === "DISBURSED" || allocation.status === "COMPLETED") &&
          existingPayout.reference === input.reference && existingPayout.amount.equals(order.amount) &&
          existingPayout.currency === order.currency && existingPayout.status === "COMPLETED" && existingPayout.mode === "SIMULATED") {
        return { result: toResult(existingPayout), duplicate: true };
      }
      throw new HttpError("VALIDATION_ERROR", "A supplier payment already exists for this purchase order");
    }
    if (!(["APPROVED", "DISBURSED"].includes(allocation.status))) {
      throw new HttpError("VALIDATION_ERROR", "Only an approved allocation can receive a supplier payment");
    }
    if (allocation.request.status !== "APPROVED") {
      throw new HttpError("VALIDATION_ERROR", "The allocation does not have a valid approved assistance case");
    }
    if (order.merchant.status !== "APPROVED") {
      throw new HttpError("VALIDATION_ERROR", "Payment is on hold because the supplier is not approved");
    }
    if (!/^[A-Z]{3}$/.test(order.currency) || new Prisma.Decimal(order.amount).lessThanOrEqualTo(0) ||
        !order.amount.equals(allocation.amount) || order.currency !== allocation.currency || allocation.campaign.currency !== allocation.currency) {
      throw new HttpError("VALIDATION_ERROR", "The purchase order has an invalid amount or currency");
    }
    if (allocation.status === "DISBURSED") {
      throw new HttpError("VALIDATION_ERROR", "Allocation is disbursed but has no matching supplier payment record");
    }

    const [captured, committed] = await Promise.all([
      tx.donation.aggregate({
        where: { campaignId: allocation.campaignId, currency: allocation.currency, status: "CAPTURED" },
        _sum: { amount: true },
      }),
      tx.payout.aggregate({
        where: {
          currency: allocation.currency,
          status: { in: ["PENDING", "PROCESSING", "COMPLETED"] },
          allocation: { is: { campaignId: allocation.campaignId } },
        },
        _sum: { amount: true },
      }),
    ]);
    const capturedAmount = captured._sum.amount ?? new Prisma.Decimal(0);
    const committedAmount = committed._sum.amount ?? new Prisma.Decimal(0);
    const available = capturedAmount.minus(committedAmount);
    if (available.lessThan(order.amount)) {
      throw new HttpError("VALIDATION_ERROR", "Captured campaign donations are insufficient for this supplier payment", {
        available: Math.max(0, available.toNumber()), currency: allocation.currency,
      });
    }

    const transition = await tx.aidAllocation.updateMany({
      where: { id: allocation.id, status: "APPROVED" },
      data: { status: "DISBURSED" },
    });
    if (transition.count !== 1) {
      throw new HttpError("VALIDATION_ERROR", "Allocation status changed during payment; review and try again");
    }

    const payout = await tx.payout.create({
      data: {
        allocationId: allocation.id,
        purchaseOrderId: order.id,
        reference: input.reference,
        amount: order.amount,
        currency: order.currency,
        status: "COMPLETED",
        mode: "SIMULATED",
      },
    });
    await tx.auditLog.create({
      data: {
        actorId,
        action: "supplier.payment_simulated",
        entityType: "PurchaseOrder",
        entityId: order.id,
        details: {
          payout_id: payout.id,
          allocation_id: allocation.id,
          amount: order.amount.toString(),
          currency: order.currency,
          reference: input.reference,
          mode: "SIMULATED",
          notice: SIMULATION_NOTICE,
        },
      },
    });

    return { result: toResult(payout), duplicate: false };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}
