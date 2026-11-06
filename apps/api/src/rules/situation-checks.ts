import type { AccessFactorKey, SituationRequest, SituationResult } from "@lifeline/contracts";

// Owner: Member 1. Deterministic checks applied to every Situation Agent reply.
// The LLM output is a draft; this code guarantees that unknowns are never hidden.

const ACCESS_KEYS: AccessFactorKey[] = [
  "bank_availability",
  "atm_access",
  "wallet_acceptance",
  "cash_availability",
  "merchant_acceptance",
  "connectivity",
];

/**
 * - Falls back to the form's currency / location when the model returned null.
 * - Rebuilds missing_information from the result itself: every null field and every "unknown" access factor,
 *   in a fixed order. Whatever the model listed is ignored, so a known value is never reported as missing and
 *   a missing one is never left out.
 * - Removes duplicate needs.
 */
export function applySituationChecks(raw: SituationResult, input: SituationRequest): SituationResult {
  const currency = raw.currency ?? input.currency ?? null;
  const location = raw.location ?? input.location ?? null;

  const missing: string[] = [];
  if (raw.budget === null) missing.push("budget");
  if (currency === null) missing.push("currency");
  if (location === null) missing.push("location");
  for (const key of ACCESS_KEYS) {
    if (raw.access[key] === "unknown") missing.push(key);
  }

  return {
    ...raw,
    needs: [...new Set(raw.needs)],
    currency,
    location,
    missing_information: missing,
  };
}
