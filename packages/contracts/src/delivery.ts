import { z } from "zod";
import { AmountSchema, CurrencySchema } from "./common";

export const DeliveryFulfilmentStatusSchema = z.enum([
  "awaiting_acceptance", "accepted", "preparing", "ready", "dispatched", "handed_over", "verified", "recipient_confirmed", "issue_reported",
]);

export const AssignDeliveryRequestSchema = z.object({
  allocation_id: z.string().min(1),
  merchant_id: z.string().min(1),
  partner_user_id: z.string().min(1),
});
export type AssignDeliveryRequest = z.infer<typeof AssignDeliveryRequestSchema>;

export const DeliveredItemSchema = z.object({
  basket_item_id: z.string().min(1),
  quantity: z.number().int().positive(),
});

export const SubmitDeliveryEventRequestSchema = z.object({
  status: z.enum(["accepted", "preparing", "ready", "dispatched", "handed_over"]),
  note: z.string().trim().max(500).optional(),
  delivered_items: z.array(DeliveredItemSchema).min(1).max(100).optional(),
});
export type SubmitDeliveryEventRequest = z.infer<typeof SubmitDeliveryEventRequestSchema>;

export const VerifyDeliveryRequestSchema = z.object({
  pickup_code: z.string().regex(/^\d{8}$/, "Enter the 8-digit pickup code"),
  note: z.string().trim().max(500).optional(),
  accept_shortfall: z.boolean().optional(),
  shortfall_reason: z.string().trim().min(1).max(500).optional(),
}).superRefine((value, context) => {
  if (value.accept_shortfall && !value.shortfall_reason) {
    context.addIssue({ code: "custom", path: ["shortfall_reason"], message: "A reason is required when accepting a delivery shortfall" });
  }
  if (!value.accept_shortfall && value.shortfall_reason) {
    context.addIssue({ code: "custom", path: ["shortfall_reason"], message: "A shortfall reason requires explicit NGO acceptance" });
  }
});
export type VerifyDeliveryRequest = z.infer<typeof VerifyDeliveryRequestSchema>;

export const DeliveryBasketItemSchema = z.object({
  basket_item_id: z.string(),
  name: z.string(),
  quantity: z.number().int().positive(),
});

export const DeliveredItemRecordSchema = DeliveryBasketItemSchema;

export const DeliveryEventSchema = z.object({
  status: DeliveryFulfilmentStatusSchema,
  actor_id: z.string().nullable(),
  note: z.string().nullable(),
  evidence_type: z.string().nullable(),
  delivered_items: z.array(DeliveredItemRecordSchema),
  at: z.iso.datetime(),
});

export const DeliveryRecordSchema = z.object({
  allocation_id: z.string(),
  case_id: z.string(),
  allocation_status: z.enum(["approved", "disbursed", "completed"]),
  amount: AmountSchema,
  currency: CurrencySchema,
  captured_amount: AmountSchema,
  fulfilment_status: DeliveryFulfilmentStatusSchema.nullable(),
  merchant: z.object({ merchant_id: z.string(), name: z.string() }).nullable(),
  partner: z.object({ user_id: z.string(), name: z.string(), email: z.string() }).nullable(),
  expected_items: z.array(DeliveryBasketItemSchema),
  events: z.array(DeliveryEventSchema),
});
export type DeliveryRecord = z.infer<typeof DeliveryRecordSchema>;

export const PurchaseOrderItemSchema = z.object({
  basket_item_id: z.string(),
  name: z.string(),
  category: z.string(),
  quantity: z.number().int().positive(),
  unit_price: AmountSchema,
  subtotal: AmountSchema,
});

export const PurchaseOrderSchema = z.object({
  purchase_order_id: z.string(),
  allocation_id: z.string(),
  merchant_id: z.string(),
  supplier_name: z.string(),
  amount: AmountSchema,
  currency: CurrencySchema,
  status: DeliveryFulfilmentStatusSchema,
  expected_ready_at: z.iso.datetime().nullable(),
  items: z.array(PurchaseOrderItemSchema),
  events: z.array(DeliveryEventSchema),
});
export type PurchaseOrder = z.infer<typeof PurchaseOrderSchema>;

export const DeliveryPartnerSchema = z.object({ user_id: z.string(), name: z.string(), email: z.string() });
export type DeliveryPartner = z.infer<typeof DeliveryPartnerSchema>;
