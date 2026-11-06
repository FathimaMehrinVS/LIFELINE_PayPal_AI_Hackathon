import { describe, expect, it } from "vitest";
import type { FinanceResult } from "@lifeline/contracts";
import type { PrismaClient } from "../../apps/api/src/generated/prisma/client";
import { saveFinancialAssessment } from "../../apps/api/src/modules/finance/finance.persistence";

const financeResult: FinanceResult = {
  recommended_route_id: "route_paypal",
  currency: "EUR",
  routes: [
    {
      route_id: "route_paypal",
      estimated_fee: 15,
      fee_label: "estimate",
      usable_value: 285,
      accessibility: { score: 91, version: "v1", factors: [] },
      verdict: "pass",
      flags: [],
    },
  ],
  explanation: "PayPal leaves €285 usable.",
};

function createPrismaStub() {
  const calls: unknown[] = [];
  const prisma = {
    financialAssessment: {
      upsert: async (args: unknown) => {
        calls.push(args);
        return { id: "financial_1" };
      },
    },
  } as unknown as PrismaClient;
  return { prisma, calls };
}

describe("saveFinancialAssessment", () => {
  it("stores the assessment under its existing assistance request", async () => {
    const { prisma, calls } = createPrismaStub();

    const saved = await saveFinancialAssessment("request_123", financeResult, prisma);

    expect(saved).toEqual({ id: "financial_1" });
    expect(calls[0]).toMatchObject({
      where: { requestId: "request_123" },
      create: {
        requestId: "request_123",
        recommendedRouteId: "route_paypal",
        currency: "EUR",
        scoreVersion: "v1",
        explanation: "PayPal leaves €285 usable.",
        routes: financeResult.routes,
      },
      update: {
        recommendedRouteId: "route_paypal",
        currency: "EUR",
        scoreVersion: "v1",
        explanation: "PayPal leaves €285 usable.",
        routes: financeResult.routes,
      },
    });
  });

  it("updates the same row when the assessment is recalculated", async () => {
    const { prisma, calls } = createPrismaStub();
    const revisedResult: FinanceResult = {
      ...financeResult,
      recommended_route_id: null,
      explanation: "No route passed the checks.",
    };

    await saveFinancialAssessment("request_123", financeResult, prisma);
    await saveFinancialAssessment("request_123", revisedResult, prisma);

    expect(calls).toHaveLength(2);
    expect(calls[1]).toMatchObject({
      where: { requestId: "request_123" },
      update: {
        recommendedRouteId: null,
        explanation: "No route passed the checks.",
      },
    });
  });
});
