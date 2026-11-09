import { z } from "zod";
import { AmountSchema, CurrencySchema } from "./common";

// Owner: Member 2 (feature/financial-intelligence).
// An allocation is an NGO decision recorded in the internal ledger, never a PayPal balance.

export const AllocationStatusSchema = z.enum(["proposed", "approved", "rejected", "disbursed", "completed"]);
export type AllocationStatus = z.infer<typeof AllocationStatusSchema>;

/** POST /api/allocations/approve — records an NGO-approved amount for an eligible assistance case. */
export const ApproveAllocationRequestSchema = z.object({
  case_id: z.string().min(1),
  campaign_id: z.string().min(1),
  amount: AmountSchema.positive(),
  currency: CurrencySchema,
});
export type ApproveAllocationRequest = z.infer<typeof ApproveAllocationRequestSchema>;

export const AllocationResultSchema = z.object({
  allocation_id: z.string(),
  case_id: z.string(),
  status: AllocationStatusSchema,
  amount: AmountSchema,
  currency: CurrencySchema,
  /** ISO timestamp; null until approved. */
  approved_at: z.iso.datetime().nullable(),
});
export type AllocationResult = z.infer<typeof AllocationResultSchema>;
