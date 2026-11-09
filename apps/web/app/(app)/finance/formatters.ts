import type { FinancialRoute, RiskFlag } from "@lifeline/contracts";

export function formatMoney(currency: string, amount: number): string {
  return new Intl.NumberFormat("en-IE", { style: "currency", currency }).format(amount);
}

export function formatAmountLabel(label: FinancialRoute["fee_label"]): string {
  if (label === "illustrative") return "Illustrative example";
  if (label === "confirmed") return "Confirmed";
  return "Estimate";
}

export function formatName(value: string): string {
  return value.replaceAll("_", " ");
}

export function flagEvidence(flag: RiskFlag): string {
  const evidence = flag.evidence;
  if (!evidence) return "This route needs a closer look.";

  if (
    flag.code === "FEE_ABOVE_REFERENCE" &&
    typeof evidence.observed_percent === "number" &&
    typeof evidence.reference_min_percent === "number" &&
    typeof evidence.reference_max_percent === "number"
  ) {
    return `${evidence.observed_percent}% fee vs. ${evidence.reference_min_percent}–${evidence.reference_max_percent}% reference range`;
  }

  if (typeof evidence.factor === "string" && typeof evidence.status === "string") {
    return `${formatName(evidence.factor)}: ${evidence.status}`;
  }

  return Object.entries(evidence)
    .map(([key, value]) => `${formatName(key)}: ${value}`)
    .join(" · ");
}
