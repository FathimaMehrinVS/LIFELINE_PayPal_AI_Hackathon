import { z } from "zod";
import { AmountSchema, CurrencySchema, NeedCategorySchema, UrgencySchema } from "./common";

/** POST /api/situation/analyze — owner: Member 1 (feature/situation-agent) */
export const SituationRequestSchema = z.object({
  message: z.string().min(1).max(4000),
  location: z.string().min(1).optional(),
  currency: CurrencySchema.optional(),
});
export type SituationRequest = z.infer<typeof SituationRequestSchema>;

export const SituationResultSchema = z.object({
  needs: z.array(NeedCategorySchema),
  /** null when the user did not state a budget (it is then listed in missing_information). */
  budget: AmountSchema.nullable(),
  currency: CurrencySchema,
  location: z.string().nullable(),
  urgency: UrgencySchema,
  missing_information: z.array(z.string()),
  confidence: z.number().min(0).max(1),
});
export type SituationResult = z.infer<typeof SituationResultSchema>;
