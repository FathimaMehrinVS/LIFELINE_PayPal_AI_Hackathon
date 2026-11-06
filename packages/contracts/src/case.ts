import { z } from "zod";
import { CommerceResultSchema } from "./commerce";
import { FinanceResultSchema } from "./finance";
import { SituationResultSchema } from "./situation";

// Owner: Member 1 (feature/situation-agent). The Orchestrator chains the three modules.

/**
 * complete          — situation, finance and basket all produced
 * needs_information — budget or currency missing; the case stops after the situation step
 * no_usable_route   — no financial route passed; the case stops after the finance step
 */
export const CaseStatusSchema = z.enum(["complete", "needs_information", "no_usable_route"]);
export type CaseStatus = z.infer<typeof CaseStatusSchema>;

/** Returned by POST /api/cases (one case) and GET /api/cases (a list). Later steps are null when the case stopped. */
export const CaseResultSchema = z.object({
  case_id: z.string(),
  status: CaseStatusSchema,
  situation: SituationResultSchema,
  finance: FinanceResultSchema.nullable(),
  commerce: CommerceResultSchema.nullable(),
  missing_information: z.array(z.string()),
});
export type CaseResult = z.infer<typeof CaseResultSchema>;
