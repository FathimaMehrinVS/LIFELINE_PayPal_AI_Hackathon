import { z } from "zod";
import { AmountSchema, CurrencySchema } from "./common";

export const PaymentStatusSchema = z.enum(["created", "approved", "captured", "failed", "cancelled"]);
export type PaymentStatus = z.infer<typeof PaymentStatusSchema>;

/** POST /api/payments — owner: Member 3 (feature/commerce-payments) */
export const CreatePaymentRequestSchema = z.object({
  request_id: z.string().min(1),
  route_id: z.string().min(1),
  amount: AmountSchema.positive(),
  currency: CurrencySchema,
});
export type CreatePaymentRequest = z.infer<typeof CreatePaymentRequestSchema>;

/** Returned by POST /api/payments and POST /api/payments/:id/capture */
export const PaymentResultSchema = z.object({
  payment_id: z.string(),
  provider: z.literal("paypal"),
  status: PaymentStatusSchema,
  amount: AmountSchema,
  currency: CurrencySchema,
  /** PayPal approval link, present while status is "created". */
  approval_url: z.url().optional(),
});
export type PaymentResult = z.infer<typeof PaymentResultSchema>;
