import { z } from "zod";
import { AccessFactorsSchema, AmountSchema, CurrencySchema, NeedCategorySchema, UrgencySchema } from "./common";

/** POST /api/situation/analyze — owner: Member 1 (feature/situation-agent) */
export const SituationRequestSchema = z.object({
  message: z.string().min(1).max(4000),
  /** Optional hints from the form; the message itself is the main input. */
  location: z.string().min(1).optional(),
  currency: CurrencySchema.optional(),
  /** Set by the NGO: how much it will spend on this case. Takes priority over any amount in the message. */
  assistance_amount: AmountSchema.positive().optional(),
});
export type SituationRequest = z.infer<typeof SituationRequestSchema>;

export const SituationResultSchema = z.object({
  /** One or two plain-language sentences for the user. */
  summary: z.string(),
  needs: z.array(NeedCategorySchema),
  /** null when not stated; then listed in missing_information. */
  budget: AmountSchema.nullable(),
  currency: CurrencySchema.nullable(),
  location: z.string().nullable(),
  urgency: UrgencySchema,
  access: AccessFactorsSchema,
  /** Facts the user should be asked for, e.g. "wallet_acceptance", "budget". */
  missing_information: z.array(z.string()),
  confidence: z.number().min(0).max(1),
  /** People who need help, only when the message makes it clear. Never asked for, so it can't delay aid. */
  household_size: z.number().int().positive().nullable().optional(),
  /** Circumstances in the message's own words, e.g. "diabetic mother", "2 children". */
  special_needs: z.array(z.string()).nullable().optional(),
});
export type SituationResult = z.infer<typeof SituationResultSchema>;
