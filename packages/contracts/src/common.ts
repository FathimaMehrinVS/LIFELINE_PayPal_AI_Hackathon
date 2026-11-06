import { z } from "zod";

/** ISO 4217 currency code, e.g. "INR", "USD". */
export const CurrencySchema = z.string().regex(/^[A-Z]{3}$/, "Must be a 3-letter ISO 4217 code");
export type Currency = z.infer<typeof CurrencySchema>;

/**
 * Monetary amount in major units (e.g. 4200.50 INR), at most 2 decimal places.
 * Fee and payment maths must be done deterministically in code, never by the LLM.
 */
export const AmountSchema = z.number().nonnegative().multipleOf(0.01);

export const UrgencySchema = z.enum(["low", "medium", "high", "critical"]);
export type Urgency = z.infer<typeof UrgencySchema>;

export const NeedCategorySchema = z.enum([
  "food",
  "water",
  "medicine",
  "shelter",
  "hygiene",
  "clothing",
  "transport",
  "other",
]);
export type NeedCategory = z.infer<typeof NeedCategorySchema>;

export const ErrorCodeSchema = z.enum([
  "VALIDATION_ERROR",
  "NOT_FOUND",
  "NOT_IMPLEMENTED",
  "UPSTREAM_ERROR",
  "INTERNAL_ERROR",
]);
export type ErrorCode = z.infer<typeof ErrorCodeSchema>;

/** Every module returns errors in this shape. */
export const ApiErrorSchema = z.object({
  error: z.object({
    code: ErrorCodeSchema,
    message: z.string(),
    details: z.unknown().optional(),
  }),
});
export type ApiError = z.infer<typeof ApiErrorSchema>;
