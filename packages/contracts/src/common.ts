import { z } from "zod";

/** ISO 4217 currency code, e.g. "EUR", "INR". */
/** Planning defaults used when a report doesn't say. Shown to the NGO, which reviews every plan before approving it. */
export const PLANNING_HOUSEHOLD_SIZE = 4;
export const PLANNING_DAYS_OF_COVER = 7;

export const CurrencySchema = z.string().regex(/^[A-Z]{3}$/, "Must be a 3-letter ISO 4217 code");
export type Currency = z.infer<typeof CurrencySchema>;

/**
 * Monetary amount in major units (e.g. 285.50 EUR), at most 2 decimal places.
 * Fee and payment maths must be done deterministically in code, never by the LLM.
 */
export const AmountSchema = z.number().nonnegative().multipleOf(0.01);

/** Every amount shown to a user says whether it is an estimate, confirmed, or an illustrative example. */
export const AmountLabelSchema = z.enum(["estimate", "confirmed", "illustrative"]);
export type AmountLabel = z.infer<typeof AmountLabelSchema>;

export const UrgencySchema = z.enum(["low", "medium", "high", "critical"]);
export type Urgency = z.infer<typeof UrgencySchema>;

export const NeedCategorySchema = z.enum([
  "food",
  "water",
  "medicine",
  "shelter",
  "hygiene",
  "baby_supplies",
  "clothing",
  "transport",
  "other",
]);
export type NeedCategory = z.infer<typeof NeedCategorySchema>;

/** Missing data stays "unknown"; it is never silently turned into "available". */
export const AvailabilitySchema = z.enum(["available", "limited", "unavailable", "unknown"]);
export type Availability = z.infer<typeof AvailabilitySchema>;

/**
 * Practical financial access around the recipient.
 * Produced by the Situation module (Member 1), consumed by the Financial module (Member 2).
 */
export const AccessFactorsSchema = z.object({
  bank_availability: AvailabilitySchema,
  atm_access: AvailabilitySchema,
  wallet_acceptance: AvailabilitySchema,
  cash_availability: AvailabilitySchema,
  merchant_acceptance: AvailabilitySchema,
  connectivity: AvailabilitySchema,
});
export type AccessFactors = z.infer<typeof AccessFactorsSchema>;
export const AccessFactorKeySchema = AccessFactorsSchema.keyof();
export type AccessFactorKey = z.infer<typeof AccessFactorKeySchema>;

export const ErrorCodeSchema = z.enum([
  "VALIDATION_ERROR",
  "AUTHENTICATION_REQUIRED",
  "FORBIDDEN",
  "CONFLICT",
  "NOT_FOUND",
  "NOT_IMPLEMENTED",
  "RATE_LIMITED",
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
