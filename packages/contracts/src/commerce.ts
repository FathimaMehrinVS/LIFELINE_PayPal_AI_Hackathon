import { z } from "zod";
import { AmountLabelSchema, AmountSchema, AvailabilitySchema, CurrencySchema, NeedCategorySchema } from "./common";

/** POST /api/commerce/basket — owner: Member 3 (feature/commerce-payments) */
export const CommerceRequestSchema = z.object({
  needs: z.array(NeedCategorySchema).min(1),
  /** Usable funds after route fees. */
  budget: AmountSchema.positive(),
  currency: CurrencySchema,
  location: z.string().min(1),
  /** Share of the budget to keep as an emergency reserve, 0 to 0.5. */
  reserve_ratio: z.number().min(0).max(0.5).default(0.2),
  /** With a household size, quantities are planned for these people; without one, each item is quantity 1. */
  household_size: z.number().int().positive().optional(),
  days_of_cover: z.number().int().positive().max(90).optional(),
});
export type CommerceRequest = z.infer<typeof CommerceRequestSchema>;
/** What a client sends (reserve_ratio may be omitted). */
export type CommerceRequestInput = z.input<typeof CommerceRequestSchema>;

export const BasketItemSchema = z.object({
  product_id: z.string(),
  name: z.string(),
  category: NeedCategorySchema,
  merchant_id: z.string(),
  merchant_name: z.string(),
  /** channel3 = online catalogue; local_registry = synthetic demo merchant data. */
  source: z.enum(["channel3", "local_registry"]),
  availability: AvailabilitySchema,
  quantity: z.number().int().positive(),
  unit_price: AmountSchema,
  subtotal: AmountSchema,
  price_label: AmountLabelSchema,
  purchase_url: z.url().optional(),
});
export type BasketItem = z.infer<typeof BasketItemSchema>;

export const CommerceResultSchema = z.object({
  items: z.array(BasketItemSchema),
  /** Cheaper or substitute options the user can swap in. */
  alternatives: z.array(BasketItemSchema),
  total: AmountSchema,
  /** budget − total, kept so the family retains flexibility. */
  reserve: AmountSchema,
  currency: CurrencySchema,
  /** Needs the budget could not cover. */
  unmet_needs: z.array(NeedCategorySchema),
  explanation: z.string(),
});
export type CommerceResult = z.infer<typeof CommerceResultSchema>;
