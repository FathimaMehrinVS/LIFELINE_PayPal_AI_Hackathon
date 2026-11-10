/** Match only explicit payment or account detail conflict reports from open supplier incidents. */
export function incidentReportsPaymentDetailsConflict(description: string): boolean {
  const financeTerm = "(?:payment|payout|bank|account|wallet|payee)";
  const conflictTerm = "(?:conflict(?:ing)?|mismatch(?:ed)?|different|chang(?:e|ed|ing)|alter(?:ed|ation)|discrepancy|unverified|unauthorized)";
  const nearby = new RegExp(`\\b${financeTerm}\\b.{0,80}\\b${conflictTerm}\\b|\\b${conflictTerm}\\b.{0,80}\\b${financeTerm}\\b`, "i");
  return nearby.test(description);
}
