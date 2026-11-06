import { z } from "zod";
import {
  AccessFactorKeySchema,
  AccessFactorsSchema,
  AmountLabelSchema,
  AmountSchema,
  AvailabilitySchema,
  CurrencySchema,
} from "./common";

export const RouteTypeSchema = z.enum([
  "paypal",
  "bank_transfer",
  "digital_wallet",
  "cash_agent",
  "direct_merchant",
  "other",
]);
export type RouteType = z.infer<typeof RouteTypeSchema>;

/** A way of getting money to the recipient, with its disclosed fees. */
export const FinancialRouteSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  type: RouteTypeSchema,
  fee_fixed: AmountSchema,
  fee_percent: z.number().min(0).max(100),
  fee_label: AmountLabelSchema,
  /** Access factors the recipient needs for this route to be usable. */
  requires: z.array(AccessFactorKeySchema),
  /** Whether support for this corridor has been verified. Unverified routes are never presented as working. */
  eligibility: z.enum(["verified", "unverified", "unsupported"]),
  estimated_minutes: z.number().int().nonnegative().optional(),
});
export type FinancialRoute = z.infer<typeof FinancialRouteSchema>;

export const RiskSeveritySchema = z.enum(["info", "warning", "critical"]);

/** A request for review, not proof of wrongdoing. */
export const RiskFlagSchema = z.object({
  code: z.string().min(1),
  severity: RiskSeveritySchema,
  message: z.string(),
  /** e.g. { observed_percent: 20, reference_min_percent: 3, reference_max_percent: 6 } */
  evidence: z.record(z.string(), z.union([z.string(), z.number()])).optional(),
});
export type RiskFlag = z.infer<typeof RiskFlagSchema>;

/** Calculated by deterministic code in apps/api/src/rules; the LLM only explains it. */
export const AccessibilityScoreSchema = z.object({
  score: z.number().int().min(0).max(100),
  version: z.string(),
  factors: z.array(
    z.object({
      factor: z.string(),
      status: AvailabilitySchema,
      weight: z.number().min(0).max(1),
      points: z.number().min(0),
    }),
  ),
});
export type AccessibilityScore = z.infer<typeof AccessibilityScoreSchema>;

export const RouteAssessmentSchema = z.object({
  route_id: z.string(),
  estimated_fee: AmountSchema,
  fee_label: AmountLabelSchema,
  /** Amount left for the recipient after fees. */
  usable_value: AmountSchema,
  accessibility: AccessibilityScoreSchema,
  verdict: z.enum(["pass", "review", "block"]),
  flags: z.array(RiskFlagSchema),
});
export type RouteAssessment = z.infer<typeof RouteAssessmentSchema>;

/** POST /api/finance/evaluate — owner: Member 2 (feature/financial-intelligence) */
export const FinanceRequestSchema = z.object({
  amount: AmountSchema.positive(),
  currency: CurrencySchema,
  access: AccessFactorsSchema,
  routes: z.array(FinancialRouteSchema).min(1),
});
export type FinanceRequest = z.infer<typeof FinanceRequestSchema>;

export const FinanceResultSchema = z.object({
  /** null when no route passes; never recommend a blocked route. */
  recommended_route_id: z.string().nullable(),
  currency: CurrencySchema,
  routes: z.array(RouteAssessmentSchema),
  /** Plain-language explanation of the recommendation and rejected routes. */
  explanation: z.string(),
});
export type FinanceResult = z.infer<typeof FinanceResultSchema>;
