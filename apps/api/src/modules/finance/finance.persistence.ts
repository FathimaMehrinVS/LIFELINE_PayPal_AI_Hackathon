import type { FinanceResult } from "@lifeline/contracts";
import type { Prisma, PrismaClient } from "../../generated/prisma/client";
import { getPrisma } from "../../database/prisma";

/**
 * Persist one financial result against its existing AssistanceRequest.
 * The request row must be created by the Orchestrator before this is called.
 */
export async function saveFinancialAssessment(
  requestId: string,
  result: FinanceResult,
  prisma: PrismaClient = getPrisma(),
) {
  const routes = JSON.parse(JSON.stringify(result.routes)) as Prisma.InputJsonValue;
  const scoreVersion = result.routes[0]?.accessibility.version ?? "v1";
  const data = {
    recommendedRouteId: result.recommended_route_id,
    currency: result.currency,
    routes,
    scoreVersion,
    explanation: result.explanation,
  };

  return prisma.financialAssessment.upsert({
    where: { requestId },
    create: { requestId, ...data },
    update: data,
  });
}
