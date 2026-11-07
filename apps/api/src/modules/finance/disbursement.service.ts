import type { CreatePayoutRequest, PayoutResult } from "@lifeline/contracts";
import { Prisma } from "../../generated/prisma/client";
import { getPrisma } from "../../database/prisma";
import { HttpError } from "../../utils/http-error";

const SIMULATION_NOTICE = "Demo fallback: simulated disbursement only. No PayPal payout was sent and no money was transferred to the recipient.";

function toResult(payout: {
  id: string;
  allocationId: string;
  status: string;
  amount: Prisma.Decimal;
  currency: string;
  mode: string;
  paypalBatchId: string | null;
}): PayoutResult {
  return {
    payout_id: payout.id,
    allocation_id: payout.allocationId,
    status: payout.status.toLowerCase() as PayoutResult["status"],
    amount: payout.amount.toNumber(),
    currency: payout.currency,
    mode: payout.mode.toLowerCase() as PayoutResult["mode"],
    ...(payout.paypalBatchId ? { paypal_batch_id: payout.paypalBatchId } : {}),
    ...(payout.mode === "SIMULATED" ? { notice: SIMULATION_NOTICE } : {}),
  };
}

/**
 * Records an internal demo disbursement after confirming captured campaign funds.
 * This deliberately makes no PayPal payout call and does not change Donation payment state.
 */
export async function simulateAllocationDisbursement(
  input: CreatePayoutRequest,
  getDatabase: typeof getPrisma = getPrisma,
): Promise<{ result: PayoutResult; duplicate: boolean }> {
  const db = getDatabase();

  return db.$transaction(async (tx) => {
    const allocation = await tx.aidAllocation.findUnique({
      where: { id: input.allocation_id },
      include: { request: true, campaign: true },
    });
    if (!allocation) throw new HttpError("NOT_FOUND", "Assistance allocation not found");

    const existingPayout = await tx.payout.findFirst({
      where: { allocationId: allocation.id },
      orderBy: { createdAt: "asc" },
    });

    if (allocation.status === "DISBURSED") {
      if (!existingPayout) throw new HttpError("VALIDATION_ERROR", "Allocation is disbursed but has no payout record");
      if (existingPayout.amount.equals(input.amount) && existingPayout.currency === input.currency &&
          existingPayout.status === "COMPLETED" && existingPayout.mode === "SIMULATED") {
        return { result: toResult(existingPayout), duplicate: true };
      }
      throw new HttpError("VALIDATION_ERROR", "This allocation already has a different disbursement record");
    }
    if (allocation.status !== "APPROVED") {
      throw new HttpError("VALIDATION_ERROR", "Only an approved assistance allocation can be disbursed");
    }
    if (!allocation.request || allocation.request.status !== "APPROVED") {
      throw new HttpError("VALIDATION_ERROR", "The allocation does not have a valid approved assistance case");
    }
    if (existingPayout) throw new HttpError("VALIDATION_ERROR", "A payout record already exists for this allocation");
    if (!/^[A-Z]{3}$/.test(allocation.currency) || new Prisma.Decimal(allocation.amount).lessThanOrEqualTo(0)) {
      throw new HttpError("VALIDATION_ERROR", "The approved allocation has an invalid amount or currency");
    }
    if (input.currency !== allocation.currency || allocation.campaign.currency !== allocation.currency) {
      throw new HttpError("VALIDATION_ERROR", "Payout currency must match the approved allocation and campaign");
    }
    if (!new Prisma.Decimal(input.amount).equals(allocation.amount)) {
      throw new HttpError("VALIDATION_ERROR", "Simulated disbursement amount must match the approved allocation amount");
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
    const requested = new Prisma.Decimal(input.amount);
    if (available.lessThan(requested)) {
      throw new HttpError("VALIDATION_ERROR", "Captured campaign donations are insufficient for this disbursement", {
        available: Math.max(0, available.toNumber()), currency: allocation.currency,
      });
    }

    const transition = await tx.aidAllocation.updateMany({
      where: { id: allocation.id, status: "APPROVED" },
      data: { status: "DISBURSED" },
    });
    if (transition.count !== 1) {
      throw new HttpError("VALIDATION_ERROR", "Allocation status changed during disbursement; review and try again");
    }

    const payout = await tx.payout.create({
      data: {
        allocationId: allocation.id,
        amount: requested,
        currency: allocation.currency,
        status: "COMPLETED",
        mode: "SIMULATED",
      },
    });
    await tx.auditLog.create({
      data: {
        action: "allocation.disbursement_simulated",
        entityType: "AidAllocation",
        entityId: allocation.id,
        details: {
          payout_id: payout.id,
          amount: requested.toString(),
          currency: allocation.currency,
          mode: "SIMULATED",
          notice: SIMULATION_NOTICE,
        },
      },
    });

    return { result: toResult(payout), duplicate: false };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}
