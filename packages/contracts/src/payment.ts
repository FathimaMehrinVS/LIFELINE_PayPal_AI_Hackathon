import { z } from "zod";
import { AmountSchema, CurrencySchema } from "./common";

// Donations: Member 3 (feature/commerce-payments). Payouts: Member 2 (feature/financial-intelligence).
// Payment state comes only from the backend after PayPal confirms it — never from the browser reaching a success page.

export const DonationStatusSchema = z.enum(["created", "approved", "captured", "failed", "cancelled", "refunded"]);
export type DonationStatus = z.infer<typeof DonationStatusSchema>;

/** POST /api/payments/donations — creates a PayPal Sandbox order. */
export const CreateDonationRequestSchema = z.object({
  campaign_id: z.string().min(1),
  amount: AmountSchema.positive(),
  currency: CurrencySchema,
});
export type CreateDonationRequest = z.infer<typeof CreateDonationRequestSchema>;

/** Returned by POST /api/payments/donations and POST /api/payments/donations/:id/capture */
export const DonationResultSchema = z.object({
  donation_id: z.string(),
  paypal_order_id: z.string(),
  status: DonationStatusSchema,
  amount: AmountSchema,
  currency: CurrencySchema,
  /** Link the donor opens to approve the order; present while status is "created". */
  approval_url: z.url().optional(),
});
export type DonationResult = z.infer<typeof DonationResultSchema>;

export const PayoutStatusSchema = z.enum(["pending", "processing", "completed", "failed", "returned"]);
export type PayoutStatus = z.infer<typeof PayoutStatusSchema>;

/** POST /api/payments/payouts — only for an NGO-approved allocation. */
export const CreatePayoutRequestSchema = z.object({
  allocation_id: z.string().min(1),
  amount: AmountSchema.positive(),
  currency: CurrencySchema,
});
export type CreatePayoutRequest = z.infer<typeof CreatePayoutRequestSchema>;

export const PayoutResultSchema = z.object({
  payout_id: z.string(),
  allocation_id: z.string(),
  status: PayoutStatusSchema,
  amount: AmountSchema,
  currency: CurrencySchema,
  /** "sandbox" = real PayPal Sandbox payout; "simulated" = demo fallback, must be labelled as such in the UI. */
  mode: z.enum(["sandbox", "simulated"]),
  paypal_batch_id: z.string().optional(),
});
export type PayoutResult = z.infer<typeof PayoutResultSchema>;
