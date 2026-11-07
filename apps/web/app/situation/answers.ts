// Owner: Member 1. How tapped answers become plain sentences for the Situation Agent.
// Full sentences, never fragments: "No" alone means nothing to the AI without its question.

export const ACCESS_ANSWERS: Record<string, { short: string; yes: string; no: string }> = {
  bank_availability: { short: "Can they use a bank?", yes: "They can use a bank account or branch.", no: "They cannot use a bank." },
  atm_access: { short: "Is there a working ATM nearby?", yes: "There is a working ATM they can reach.", no: "They cannot reach a working ATM." },
  wallet_acceptance: {
    short: "Can they use a mobile wallet (UPI, M-Pesa, PayPal)?",
    yes: "They can receive and pay with a mobile wallet.",
    no: "They cannot use a mobile wallet.",
  },
  cash_availability: { short: "Can they get cash locally?", yes: "They can get physical cash locally.", no: "They cannot get physical cash locally." },
  merchant_acceptance: {
    short: "Are local shops open and taking payments?",
    yes: "Local shops are open and accept payments.",
    no: "Local shops are closed or cannot accept payments.",
  },
  connectivity: { short: "Do they have internet or phone signal?", yes: "They have working internet or phone signal.", no: "They have no internet or phone signal." },
};

export const NEED_OPTIONS = ["food", "water", "medicine", "shelter", "hygiene", "baby_supplies", "clothing", "transport"] as const;

export const NEED_LABELS: Record<string, string> = { baby_supplies: "baby supplies" };

export const needLabel = (need: string) => NEED_LABELS[need] ?? need;

export type Choice = "yes" | "no" | "unsure";

/** "Not sure" adds nothing: the fact stays unknown instead of being guessed. */
export function accessSentence(key: string, choice: Choice | undefined): string | null {
  const answers = ACCESS_ANSWERS[key];
  if (!answers || (choice !== "yes" && choice !== "no")) return null;
  return answers[choice];
}
