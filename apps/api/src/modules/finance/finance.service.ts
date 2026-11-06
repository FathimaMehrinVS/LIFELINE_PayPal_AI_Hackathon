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
  routes: EvaluatedRoute[],
  recommended: EvaluatedRoute | null,
): string {
  if (!recommended) {
    return "No route passed the deterministic eligibility checks, so there is no recommendation. Review the route flags before deciding how to proceed.";
  }

  const { route, assessment } = recommended;
  const feeDescription = {
    estimate: "estimated fee",
    confirmed: "confirmed fee",
    illustrative: "illustrative fee",
  }[assessment.fee_label];
  const article = assessment.fee_label === "confirmed" ? "a" : "an";
  const others = routes
    .filter((candidate) => candidate !== recommended)
    .map(({ route: otherRoute, assessment: otherAssessment }) => {
      if (otherAssessment.verdict === "pass") {
        return `${otherRoute.name} also passed with ${formatMoney(currency, otherAssessment.usable_value)} usable and an accessibility score of ${otherAssessment.accessibility.score}/100`;
      }
      const reason = otherAssessment.flags
        .find((flag) => flag.severity === "critical" || flag.severity === "warning")
        ?.message.replace(/[.!?]+$/, "");
      const verdict = otherAssessment.verdict === "block" ? "was blocked" : "needs review";
      return `${otherRoute.name} ${verdict}${reason ? `: ${reason}` : ""}`;
    });
  const comparison = others.length
    ? `Other routes: ${others.join("; ")}.`
    : "It has the highest usable value among the routes that passed.";

  return `${route.name} is recommended with ${article} ${feeDescription} of ${formatMoney(currency, assessment.estimated_fee)}, leaving ${formatMoney(currency, assessment.usable_value)} usable. ${comparison}`;
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
        routes: evaluatedRoutes.map(({ route, assessment }) => ({ name: route.name, ...assessment })),
        recommended: recommended
          ? { name: recommended.route.name, ...recommended.assessment }
          : null,
      }),
      schema: ExplanationSchema,
      temperature: 0.2,
    });
    explanation = generated.explanation;
  } catch {
    explanation = fallbackExplanation(request.currency, evaluatedRoutes, recommended);
  }

  return FinanceResultSchema.parse({
    recommended_route_id: recommended?.route.id ?? null,
    currency: request.currency,
    routes: evaluatedRoutes.map(({ assessment }) => assessment),
    explanation,
  });
}
