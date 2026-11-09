import type { ApproveAllocationRequest, AllocationResult } from "@lifeline/contracts";
import { Prisma } from "../../generated/prisma/client";
import { getPrisma } from "../../database/prisma";
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
}): AllocationResult {
  return {
    allocation_id: allocation.id,
    case_id: allocation.requestId,
    status: allocation.status.toLowerCase() as AllocationResult["status"],
    amount: allocation.amount.toNumber(),
    currency: allocation.currency,
    approved_at: allocation.approvedAt?.toISOString() ?? null,
  };
}

/**
 * Approves an eligible assistance case against captured campaign funds.
 * All eligibility and balance checks are deterministic and run in the same transaction as persistence.
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
        include: { situation: true, basket: true, allocation: true },
      });
      if (!assistance) throw new HttpError("NOT_FOUND", "Assistance case not found");
      const existing = assistance.allocation;
      const alreadyApproved = assistance.status === "APPROVED" &&
        (existing?.status === "APPROVED" || existing?.status === "DISBURSED");
      if ((assistance.status !== "AWAITING_APPROVAL" && !alreadyApproved) || !assistance.situation || !assistance.basket) {
        throw new HttpError("VALIDATION_ERROR", "Assistance case is not ready for NGO approval");
      }
      if (assistance.situation.budget === null || !assistance.situation.currency ||
          input.currency !== assistance.situation.currency ||
          new Prisma.Decimal(input.amount).gt(assistance.situation.budget)) {
        throw new HttpError("VALIDATION_ERROR", "Allocation amount and currency must fit the assistance case budget");
      }

      const campaign = await tx.campaign.findUnique({ where: { id: input.campaign_id } });
      if (!campaign?.active) throw new HttpError("NOT_FOUND", "Active campaign not found");
      if (campaign.currency !== input.currency) {
        throw new HttpError("VALIDATION_ERROR", "Allocation currency must match the campaign currency");
      }

      if (existing?.status === "APPROVED" || existing?.status === "DISBURSED") {
        if (existing.campaignId !== campaign.id || existing.currency !== input.currency ||
            !new Prisma.Decimal(existing.amount).equals(input.amount)) {
          throw new HttpError("VALIDATION_ERROR", "This case already has an allocation with different details");
        }
        if (assistance.status !== "APPROVED") {
          await tx.assistanceRequest.update({ where: { id: assistance.id }, data: { status: "APPROVED" } });
        }
        return toResult(existing);
      }
      if (existing?.status === "REJECTED") {
        throw new HttpError("VALIDATION_ERROR", "A rejected allocation cannot be approved");
      }

      // Approval records the NGO's decision for this case. Funding is collected against this approved allocation;
      // any future payout must separately verify that captured donations cover it.
      const requested = new Prisma.Decimal(input.amount);

      const approvedAt = new Date();
      const allocation = existing
        ? await tx.aidAllocation.update({
            where: { id: existing.id },
            data: { campaignId: campaign.id, amount: requested, currency: input.currency, status: "APPROVED", approvedAt },
          })
        : await tx.aidAllocation.create({
            data: {
              requestId: assistance.id,
              campaignId: campaign.id,
              amount: requested,
              currency: input.currency,
              status: "APPROVED",
              approvedAt,
            },
          });

      await tx.assistanceRequest.update({ where: { id: assistance.id }, data: { status: "APPROVED" } });

      await tx.auditLog.create({
        data: {
          actorId,
          action: "allocation.approved",
          entityType: "AidAllocation",
          entityId: allocation.id,
          details: {
            case_id: assistance.id,
            campaign_id: campaign.id,
            amount: requested.toString(),
            currency: input.currency,
          },
        },
      });

      return toResult(allocation);
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  } catch (error) {
    if (error instanceof HttpError) throw error;
    if (isUniqueConflict(error)) {
      const existing = await db.aidAllocation.findUnique({ where: { requestId: input.case_id } });
      if (existing?.status === "APPROVED" && existing.campaignId === input.campaign_id &&
          existing.currency === input.currency && new Prisma.Decimal(existing.amount).equals(input.amount)) {
        return toResult(existing);
      }
      throw new HttpError("VALIDATION_ERROR", "An allocation already exists for this case");
    }
    if (isSerializationConflict(error)) {
      throw new HttpError("VALIDATION_ERROR", "Campaign funds changed during approval; please review and try again");
    }
    throw error;
  }
}
