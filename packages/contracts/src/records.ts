import { z } from "zod";

// NGO-only views of the money and audit records.

export const LedgerTotalsSchema = z.object({
  currency: z.string(),
  captured: z.number(),
  allocated: z.number(),
  paid: z.number(),
  simulated: z.number(),
  balance: z.number(),
});

export const LedgerDonationSchema = z.object({
  id: z.string(),
  reference: z.string(),
  donor: z.string(),
  plan_reference: z.string().nullable(),
  case_id: z.string().nullable(),
  amount: z.number(),
  currency: z.string(),
  status: z.enum(["created", "approved", "captured", "failed", "cancelled", "refunded"]),
  paypal_capture_id: z.string().nullable(),
  updated_at: z.string(),
});

export const LedgerPayoutSchema = z.object({
  id: z.string(),
  reference: z.string(),
  plan_reference: z.string(),
  purchase_order_id: z.string().nullable(),
  supplier: z.string().nullable(),
  amount: z.number(),
  currency: z.string(),
  mode: z.enum(["sandbox", "simulated"]),
  status: z.enum(["pending", "processing", "completed", "failed", "returned"]),
  payment_reference: z.string().nullable(),
  created_at: z.string(),
});

export const LedgerSchema = z.object({
  totals: z.array(LedgerTotalsSchema),
  donations: z.array(LedgerDonationSchema),
  payouts: z.array(LedgerPayoutSchema),
});
export type Ledger = z.infer<typeof LedgerSchema>;

export const AuditEntrySchema = z.object({
  id: z.string(),
  action: z.string(),
  title: z.string(),
  category: z.enum(["case", "approval", "payment", "supplier", "other"]),
  actor: z.string(),
  subject: z.string().nullable(),
  from: z.string().nullable(),
  to: z.string().nullable(),
  note: z.string().nullable(),
  at: z.string(),
});
export type AuditEntry = z.infer<typeof AuditEntrySchema>;

export const IncidentSchema = z.object({
  id: z.string(),
  supplier: z.string(),
  severity: z.enum(["low", "medium", "high"]),
  status: z.enum(["open", "resolved"]),
  description: z.string(),
  purchase_order_id: z.string().nullable(),
  created_at: z.string(),
  resolved_at: z.string().nullable(),
});
export type Incident = z.infer<typeof IncidentSchema>;

export const AuditRecordsSchema = z.object({ entries: z.array(AuditEntrySchema), incidents: z.array(IncidentSchema) });
export type AuditRecords = z.infer<typeof AuditRecordsSchema>;
