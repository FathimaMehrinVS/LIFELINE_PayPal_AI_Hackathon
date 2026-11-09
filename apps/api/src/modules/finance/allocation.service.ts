import type { ApproveAllocationRequest, AllocationResult } from "@lifeline/contracts";
import { Prisma } from "../../generated/prisma/client";
import { getPrisma } from "../../database/prisma";
import { getDemoRouteCatalogue } from "./route-catalogue";
import { assessFees } from "../../rules/fees";
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
        include: { situation: true, financial: true, basket: true, allocation: true },
      });
      if (!assistance) throw new HttpError("NOT_FOUND", "Assistance case not found");
      const existing = assistance.allocation;
      const alreadyApproved = assistance.status === "APPROVED" &&
        (existing?.status === "APPROVED" || existing?.status === "DISBURSED");
      if ((assistance.status !== "AWAITING_APPROVAL" && !alreadyApproved) || !assistance.situation || !assistance.basket) {
        throw new HttpError("VALIDATION_ERROR", "Assistance case is not ready for NGO approval");
      }
      const routeId = assistance.financial?.recommendedRouteId;
      if (!assistance.basket || !routeId) throw new HttpError("VALIDATION_ERROR", "A costed basket and recommended route are required");
      const assessments = Array.isArray(assistance.financial?.routes) ? assistance.financial.routes : [];
      const recommendation = assessments.find((row) =>
        !!row && typeof row === "object" && !Array.isArray(row) &&
        "route_id" in row && row.route_id === routeId,
      );
      if (!recommendation || typeof recommendation !== "object" || Array.isArray(recommendation) || !("verdict" in recommendation) || recommendation.verdict !== "pass") {
        throw new HttpError("VALIDATION_ERROR", "The recommended route is no longer eligible for approval");
      }
      const route = getDemoRouteCatalogue(true).find((candidate) => candidate.id === routeId);
      if (!route) throw new HttpError("VALIDATION_ERROR", "The recommended route is no longer available");
      const fee = new Prisma.Decimal(assessFees(assistance.basket.total.toNumber(), route).estimated_fee);
      const amount = assistance.basket.total.plus(fee).toDecimalPlaces(2);
      const currency = assistance.basket.currency;
      if (!assistance.situation.currency || !assistance.situation.budget || currency !== assistance.situation.currency ||
          amount.lessThanOrEqualTo(0) || amount.greaterThan(assistance.situation.budget)) {
        throw new HttpError("VALIDATION_ERROR", "The basket cost and route fee do not fit the assistance case budget and currency");
      }

      const campaign = await tx.campaign.findUnique({ where: { id: input.campaign_id } });
      if (!campaign?.active) throw new HttpError("NOT_FOUND", "Active campaign not found");
      if (campaign.currency !== currency) {
        throw new HttpError("VALIDATION_ERROR", "Plan currency must match the campaign currency");
      }

      if (existing?.status === "APPROVED" || existing?.status === "DISBURSED") {
        if (existing.campaignId !== campaign.id || existing.currency !== currency ||
            !new Prisma.Decimal(existing.amount).equals(amount)) {
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
      const requested = amount;

      const approvedAt = new Date();
      const allocation = existing
        ? await tx.aidAllocation.update({
            where: { id: existing.id },
            data: { campaignId: campaign.id, amount: requested, currency, status: "APPROVED", approvedAt },
          })
        : await tx.aidAllocation.create({
            data: {
              requestId: assistance.id,
              campaignId: campaign.id,
              amount: requested,
              currency,
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
            currency,
          },
        },
      });

      return toResult(allocation);
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  } catch (error) {
    if (error instanceof HttpError) throw error;
    if (isUniqueConflict(error)) {
      throw new HttpError("VALIDATION_ERROR", "An allocation already exists for this case");
    }
    if (isSerializationConflict(error)) {
      throw new HttpError("VALIDATION_ERROR", "Campaign funds changed during approval; please review and try again");
    }
    throw error;
  }
}
