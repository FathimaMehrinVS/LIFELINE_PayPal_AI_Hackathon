import {
  FinanceResultSchema,
  type FinanceRequest,
  type FinanceResult,
  type RouteAssessment,
} from "@lifeline/contracts";
import { z } from "zod";
import { llm, type LlmClient } from "../../ai/llm-client";
import { assessAccessibility } from "../../rules/accessibility-score";
import { assessFees } from "../../rules/fees";
import { buildRouteAssessment } from "../../rules/route-eligibility";
import type { FinancialRoute } from "@lifeline/contracts";
import { EXPLANATION_PROMPT } from "./explanation.prompt";

const ExplanationSchema = z.object({ explanation: z.string().trim().min(1) });

interface EvaluatedRoute {
  route: FinancialRoute;
  assessment: RouteAssessment;
}

function getRecommendation(routes: EvaluatedRoute[]): EvaluatedRoute | null {
  let recommended: EvaluatedRoute | null = null;

  for (const candidate of routes) {
    if (candidate.assessment.verdict !== "pass") continue;
    if (
      !recommended ||
      candidate.assessment.usable_value > recommended.assessment.usable_value ||
      (candidate.assessment.usable_value === recommended.assessment.usable_value &&
        candidate.assessment.accessibility.score > recommended.assessment.accessibility.score)
    ) {
      recommended = candidate;
    }
  }

  return recommended;
}

function formatMoney(currency: string, amount: number): string {
  return `${currency} ${amount.toFixed(2)}`;
}

function fallbackExplanation(
  currency: string,
  recommended: EvaluatedRoute | null,
): string {
  if (!recommended) {
    return "We could not confirm a suitable way to deliver the money with the information available. An NGO worker can review the options and help decide what to do next.";
  }

  const { route, assessment } = recommended;
  const feeDescription = {
    estimate: "estimated fee",
    confirmed: "confirmed fee",
    illustrative: "illustrative fee",
  }[assessment.fee_label];
  return `We recommend ${route.name} for this plan. Its ${feeDescription} is ${formatMoney(currency, assessment.estimated_fee)}, leaving ${formatMoney(currency, assessment.usable_value)} for the family. An NGO worker can review the options with the family before proceeding.`;
}

/** Financial decisions are deterministic; the LLM is only asked to explain their results. */
export async function evaluateRoutes(
  request: FinanceRequest,
  llmClient: LlmClient = llm,
): Promise<FinanceResult> {
  const evaluatedRoutes: EvaluatedRoute[] = request.routes.map((route) => {
    const fees = assessFees(request.amount, route);
    const accessibility = assessAccessibility(route, request.access, fees);
    const assessment = buildRouteAssessment(route, request.access, fees, accessibility);
    return { route, assessment };
  });

  const recommended = getRecommendation(evaluatedRoutes);
  let explanation: string;
  try {
    const generated = await llmClient.generateJson({
      system: EXPLANATION_PROMPT,
      user: JSON.stringify({
        currency: request.currency,
        recommended: recommended
          ? {
              name: recommended.route.name,
              fee_label: recommended.assessment.fee_label,
              estimated_fee: recommended.assessment.estimated_fee,
              usable_value: recommended.assessment.usable_value,
            }
          : null,
      }),
      schema: ExplanationSchema,
      temperature: 0.2,
    });
    explanation = generated.explanation;
  } catch {
    explanation = fallbackExplanation(request.currency, recommended);
  }

  return FinanceResultSchema.parse({
    recommended_route_id: recommended?.route.id ?? null,
    currency: request.currency,
    routes: evaluatedRoutes.map(({ assessment }) => assessment),
    explanation,
  });
}
