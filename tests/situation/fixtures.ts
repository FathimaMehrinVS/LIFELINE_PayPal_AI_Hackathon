import type { AccessFactors, NeedCategory, SituationRequest, SituationResult } from "@lifeline/contracts";

// Owner: Member 1. Test messages for the Situation Agent, with what a correct answer must contain.
// Used by evaluate.ts (real LLM, run by hand) and fixtures.test.ts (no network).
// Every access factor not listed in `access` is expected to be "unknown": that is the hallucination check.

export interface SituationFixture {
  id: string;
  /** What this case is checking. */
  checks: string;
  input: SituationRequest;
  expect: {
    /** Needs that must be present (others are allowed). */
    needs?: NeedCategory[];
    budget?: number | null;
    currency?: string | null;
    location?: string | null;
    urgency?: SituationResult["urgency"][];
    /** Known access values; every other factor must be "unknown". */
    access: Partial<AccessFactors>;
  };
}

export const SITUATION_FIXTURES: SituationFixture[] = [
  {
    id: "proposal-300-eur",
    checks: "The proposal's demo message",
    input: {
      message:
        "My parents are in a conflict-affected area. Their bank is inaccessible and internet is intermittent. I have €300 to send. They need food and medicine.",
      currency: "EUR",
    },
    expect: {
      needs: ["food", "medicine"],
      budget: 300,
      currency: "EUR",
      location: null,
      urgency: ["high"],
      access: { bank_availability: "unavailable", connectivity: "limited" },
    },
  },
  {
    id: "kerala-no-access-info",
    checks: "A place name alone must not set any access factor",
    input: { message: "My family in Kerala needs food and medicine, budget 5000 INR" },
    expect: { needs: ["food", "medicine"], budget: 5000, currency: "INR", location: "Kerala", access: {} },
  },
  {
    id: "no-money-network-down",
    checks: "Having no money is the budget, not cash availability",
    input: { message: "we need water urgently, no money left, phone network is down" },
    expect: { needs: ["water"], currency: null, urgency: ["critical", "high"], access: { connectivity: "unavailable" } },
  },
  {
    id: "bank-works-atm-empty",
    checks: "Two different access facts in one sentence",
    input: { message: "Bank works but ATMs are empty. Need rice and baby formula, I have 150 euros" },
    expect: {
      needs: ["food", "baby_supplies"],
      budget: 150,
      currency: "EUR",
      access: { bank_availability: "available", atm_access: "unavailable" },
    },
  },
  {
    id: "typos-rupees",
    checks: "Typos and informal spelling; 'can pay' is the budget, not cash",
    input: { message: "plz help my amma needs medicin, shops r open, can pay 2000 rupees" },
    expect: { needs: ["medicine"], budget: 2000, currency: "INR", access: { merchant_acceptance: "available" } },
  },
  {
    id: "malayalam-mix",
    checks: "Mixed Malayalam and English; sender is the recipient",
    input: { message: "Ente veettil food illa, 3000 rs undu, bank closed aanu" },
    expect: { needs: ["food"], budget: 3000, currency: "INR", access: { bank_availability: "unavailable" } },
  },
  {
    id: "form-hints-only",
    checks: "Form location and currency are used; no guessing from the place name",
    input: { message: "help", location: "Gaza", currency: "USD" },
    expect: { budget: null, currency: "USD", location: "Gaza", access: {} },
  },
  {
    id: "cash-agents-closed",
    checks: "Control: real statements about cash must still be extracted",
    input: { message: "Cash agents in our town are closed and ATMs are empty. Need food, have 100 euros" },
    expect: {
      needs: ["food"],
      budget: 100,
      currency: "EUR",
      access: { cash_availability: "unavailable", atm_access: "unavailable" },
    },
  },
  {
    id: "flood-baby-usd",
    checks: "Urgency with an infant and no clean water; dollars → USD",
    input: { message: "Flood hit our village. We need clean water and baby milk for my 6 month old. I can spend 200 dollars." },
    expect: { needs: ["water", "baby_supplies"], budget: 200, currency: "USD", urgency: ["critical", "high"], access: {} },
  },
  {
    id: "vague",
    checks: "A message with almost nothing in it stays almost empty",
    input: { message: "please help us" },
    expect: { budget: null, currency: null, location: null, access: {} },
  },
  {
    id: "upi-shops-atm-broken",
    checks: "Shops taking UPI means wallets work and merchants accept payment",
    input: {
      message: "My family in Kerala needs food and medicine, budget 5000 INR. Shops near them take UPI but the ATM is broken.",
    },
    expect: {
      needs: ["food", "medicine"],
      budget: 5000,
      currency: "INR",
      location: "Kerala",
      access: { wallet_acceptance: "available", merchant_acceptance: "available", atm_access: "unavailable" },
    },
  },
  {
    id: "form-location-more-specific",
    checks: "Form district + state in the message are combined, not replaced",
    input: { message: "My family in Kerala needs food, budget 5000 INR", location: "ernakulam" },
    expect: { needs: ["food"], budget: 5000, currency: "INR", location: "Ernakulam", access: {} },
  },
  {
    id: "no-budget-phones-work",
    checks: "No amount → budget null; a positive access statement",
    input: { message: "Earthquake destroyed our house. Need shelter and blankets for 4 people. Phones still work." },
    expect: { needs: ["shelter"], budget: null, currency: null, access: { connectivity: "available" } },
  },
];
