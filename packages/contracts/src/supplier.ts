import { z } from "zod";
import { NeedCategorySchema } from "./common";

/** /api/suppliers — owner: Member 1. Only an approved supplier can receive a purchase order. */
export const SupplierStatusSchema = z.enum(["pending", "approved", "suspended"]);
export type SupplierStatus = z.infer<typeof SupplierStatusSchema>;

/** Worked out from recorded orders and complaints only. */
export const SupplierScorecardSchema = z.object({
  orders_finished: z.number().int().nonnegative(),
  orders_completed: z.number().int().nonnegative(),
  open_complaints: z.number().int().nonnegative(),
  /** Share of finished orders the recipient confirmed, 0 to 100. Null with no finished orders. */
  fulfilment_rate: z.number().min(0).max(100).nullable(),
  /** Weighted so a long record counts for more than one good order. Null with no finished orders. */
  score: z.number().min(0).max(100).nullable(),
});
export type SupplierScorecard = z.infer<typeof SupplierScorecardSchema>;

export const SupplierSchema = z.object({
  supplier_id: z.string(),
  name: z.string(),
  location: z.string(),
  service_areas: z.array(z.string()),
  categories: z.array(z.string()),
  accepts: z.array(z.string()),
  contact: z.string().nullable(),
  status: SupplierStatusSchema,
  created_at: z.string(),
  status_changed_at: z.string().nullable(),
  scorecard: SupplierScorecardSchema,
});
export type Supplier = z.infer<typeof SupplierSchema>;

export const SupplierIncidentSchema = z.object({
  incident_id: z.string(),
  severity: z.enum(["low", "medium", "high"]),
  description: z.string(),
  status: z.enum(["open", "resolved"]),
  created_at: z.string(),
});
export type SupplierIncident = z.infer<typeof SupplierIncidentSchema>;

export const SupplierHistoryEntrySchema = z.object({
  action: z.string(),
  from: SupplierStatusSchema.nullable(),
  to: SupplierStatusSchema.nullable(),
  reason: z.string().nullable(),
  actor: z.string().nullable(),
  at: z.string(),
});
export type SupplierHistoryEntry = z.infer<typeof SupplierHistoryEntrySchema>;

export const SupplierDetailSchema = SupplierSchema.extend({
  incidents: z.array(SupplierIncidentSchema),
  history: z.array(SupplierHistoryEntrySchema),
});
export type SupplierDetail = z.infer<typeof SupplierDetailSchema>;

export const CreateSupplierRequestSchema = z.object({
  name: z.string().trim().min(2).max(120),
  location: z.string().trim().min(2).max(120),
  service_areas: z.array(z.string().trim().min(1).max(120)).max(30).default([]),
  categories: z.array(NeedCategorySchema).min(1),
  /** Payment methods the supplier accepts, e.g. "Bank transfer". */
  accepts: z.array(z.string().trim().min(1).max(60)).max(10).default([]),
  contact: z.string().trim().min(1).max(200).optional(),
});
export type CreateSupplierRequest = z.infer<typeof CreateSupplierRequestSchema>;
export type CreateSupplierRequestInput = z.input<typeof CreateSupplierRequestSchema>;

export const UpdateSupplierStatusRequestSchema = z.object({
  status: SupplierStatusSchema,
  /** What the decision is based on. Recorded in the audit log. */
  reason: z.string().trim().min(5).max(500),
});
export type UpdateSupplierStatusRequest = z.infer<typeof UpdateSupplierStatusRequestSchema>;
