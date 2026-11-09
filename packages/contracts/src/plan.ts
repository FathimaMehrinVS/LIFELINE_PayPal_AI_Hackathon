import { z } from "zod";
import { CurrencySchema, NeedCategorySchema, UrgencySchema } from "./common";

// What a donor may see. There is deliberately no field here for a name, location, photo or the original message.

export const PlanFundingSchema = z.object({
  goal: z.number(),
  captured: z.number(),
  remaining: z.number(),
  percent: z.number(),
  donations: z.number().int(),
});

export const PlanStepSchema = z.object({
  key: z.string(),
  title: z.string(),
  state: z.enum(["complete", "in_progress", "not_recorded", "issue"]),
  simulated: z.boolean(),
  detail: z.string().nullable(),
  at: z.string().nullable(),
});
export type PlanStep = z.infer<typeof PlanStepSchema>;

export const DonorPlanSchema = z.object({
  plan_id: z.string(),
  case_id: z.string(),
  reference: z.string(),
  title: z.string(),
  description: z.string(),
  needs: z.array(NeedCategorySchema),
  urgency: UrgencySchema,
  currency: CurrencySchema,
  approved_at: z.string().nullable(),
  can_fund: z.boolean(),
  delivery_confirmed_at: z.string().nullable(),
  funding: PlanFundingSchema,
});
export type DonorPlan = z.infer<typeof DonorPlanSchema>;

export const PlanItemSchema = z.object({
  name: z.string(),
  supplier: z.string(),
  quantity: z.number().int(),
  cost: z.number(),
  price_label: z.string(),
});

export const DonorPlanDetailSchema = DonorPlanSchema.extend({
  items: z.array(PlanItemSchema),
  /** The approved amount that the listed items do not account for. */
  not_itemised: z.number(),
  steps: z.array(PlanStepSchema),
});
export type DonorPlanDetail = z.infer<typeof DonorPlanDetailSchema>;

export const ContributionSchema = z.object({
  donation_id: z.string(),
  reference: z.string(),
  status: z.enum(["created", "approved", "captured", "refunded"]),
  amount: z.number(),
  currency: CurrencySchema,
  paypal_capture_id: z.string().nullable(),
  created_at: z.string(),
  plan: DonorPlanDetailSchema,
});
export type Contribution = z.infer<typeof ContributionSchema>;
