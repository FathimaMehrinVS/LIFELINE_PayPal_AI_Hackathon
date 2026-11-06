import { z } from "zod";
import { AmountSchema, CurrencySchema } from "./common";

export const RouteTypeSchema = z.enum(["paypal", "bank_transfer", "mobile_wallet", "cash_pickup", "other"]);
export type RouteType = z.infer<typeof RouteTypeSchema>;

export const FinancialRouteSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  type: RouteTypeSchema,
  fee_fixed: AmountSchema,
  fee_percent: z.number().min(0).max(100),
  estimated_minutes: z.number().int().nonnegative().optional(),
  accessibility_features: z.array(z.string()),
});
export type FinancialRoute = z.infer<typeof FinancialRouteSchema>;

export const RiskSeveritySchema = z.enum(["info", "warning", "critical"]);

export const RiskFlagSchema = z.object({
  code: z.string().min(1),
  severity: RiskSeveritySchema,
  message: z.string(),
});
export type RiskFlag = z.infer<typeof RiskFlagSchema>;

/** POST /api/finance/evaluate — owner: Member 2 (feature/financial-intelligence) */
export const FinanceRequestSchema = z.object({
  budget: AmountSchema,
  currency: CurrencySchema,
  available_routes: z.array(FinancialRouteSchema),
  accessibility_requirements: z.array(z.string()),
});
export type FinanceRequest = z.infer<typeof FinanceRequestSchema>;

export const FinanceResultSchema = z.object({
  /** id of one of the available_routes */
  recommended_route: z.string(),
  estimated_fee: AmountSchema,
  accessibility_score: z.number().int().min(0).max(100),
  risk_flags: z.array(RiskFlagSchema),
  explanation: z.string(),
});
export type FinanceResult = z.infer<typeof FinanceResultSchema>;
