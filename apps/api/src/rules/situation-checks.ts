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

/** "ernakulam  district" → "Ernakulam District" */
function titleCase(text: string) {
  return text
    .trim()
    .split(/\s+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

/**
 * The location the person typed in the form is a deliberate answer, so it is never dropped. The model is asked to
 * combine it with the message ("Ernakulam, Kerala"); if its location doesn't contain the form value, add it in front.
 */
function withFormLocation(modelLocation: string | null, formLocation: string | undefined) {
  if (!formLocation?.trim()) return modelLocation;
  const form = titleCase(formLocation);
  if (!modelLocation) return form;
  if (modelLocation.toLowerCase().includes(form.toLowerCase())) return modelLocation;
  return `${form}, ${modelLocation}`;
}

/**
 * - Falls back to the form's currency when the model returned null.
 * - Always keeps the form's location, combined with the model's (see withFormLocation).
 * - Rebuilds missing_information from the result itself: every null field and every "unknown" access factor,
 *   in a fixed order. Whatever the model listed is ignored, so a known value is never reported as missing and
 *   a missing one is never left out.
 * - Removes duplicate needs.
 */
export function applySituationChecks(raw: SituationResult, input: SituationRequest): SituationResult {
  const currency = raw.currency ?? input.currency ?? null;
  const location = withFormLocation(raw.location, input.location);

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
