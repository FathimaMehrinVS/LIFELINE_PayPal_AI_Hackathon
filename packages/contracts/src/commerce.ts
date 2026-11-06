import { z } from "zod";
import { AmountSchema, CurrencySchema, NeedCategorySchema } from "./common";

/** POST /api/commerce/basket — owner: Member 3 (feature/commerce-payments) */
export const CommerceRequestSchema = z.object({
  needs: z.array(NeedCategorySchema).min(1),
  budget: AmountSchema,
  currency: CurrencySchema,
  location: z.string().min(1),
});
export type CommerceRequest = z.infer<typeof CommerceRequestSchema>;

export const BasketItemSchema = z.object({
  product_id: z.string(),
  name: z.string(),
  merchant_id: z.string(),
  category: NeedCategorySchema,
  quantity: z.number().int().positive(),
  unit_price: AmountSchema,
  subtotal: AmountSchema,
});
export type BasketItem = z.infer<typeof BasketItemSchema>;

export const CommerceResultSchema = z.object({
  items: z.array(BasketItemSchema),
  total: AmountSchema,
  currency: CurrencySchema,
  remaining_budget: AmountSchema,
});
export type CommerceResult = z.infer<typeof CommerceResultSchema>;
