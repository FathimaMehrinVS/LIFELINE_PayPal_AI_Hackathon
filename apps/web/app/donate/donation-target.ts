export type DonationTarget = { allocationId: string; caseId: string; amount: number; currency: string };

/** Parse dashboard links and PayPal cancel links into the approved donation target. */
export function parseDonationTarget(search: string): DonationTarget | null {
  const params = new URLSearchParams(search);
  const allocationId = params.get("allocation_id")?.trim();
  const caseId = params.get("case_id")?.trim();
  const amountParam = params.get("amount") ?? "";

  // Some PayPal cancel links decode the legacy `&curren` entity in `&currency`
  // into a currency sign, appending `¤cy=...` to the preceding amount value.
  const legacyCurrency = amountParam.match(/^(.+)¤cy=([A-Z]{3})$/);
  const amount = Number(legacyCurrency?.[1] ?? amountParam);
  const currency = params.get("currency") ?? params.get("ccy") ?? legacyCurrency?.[2] ?? "";

  if (!allocationId || !caseId || !Number.isFinite(amount) || amount <= 0 || !/^[A-Z]{3}$/.test(currency)) return null;
  return { allocationId, caseId, amount, currency };
}
