import type { FinanceRequest } from "@lifeline/contracts";

export const SAMPLE_REQUEST: FinanceRequest = {
  amount: 300,
  currency: "EUR",
  access: {
    bank_availability: "unavailable",
    atm_access: "unavailable",
    wallet_acceptance: "available",
    cash_availability: "limited",
    merchant_acceptance: "available",
    connectivity: "limited",
  },
  routes: [
    {
      id: "route_bank",
      name: "Bank transfer",
      type: "bank_transfer",
      fee_fixed: 0,
      fee_percent: 2,
      fee_label: "illustrative",
      requires: ["bank_availability"],
      eligibility: "verified",
      estimated_minutes: 2880,
    },
    {
      id: "route_agent",
      name: "Local cash-out agent",
      type: "cash_agent",
      fee_fixed: 0,
      fee_percent: 20,
      fee_label: "illustrative",
      requires: ["cash_availability"],
      eligibility: "unverified",
      estimated_minutes: 120,
    },
    {
      id: "route_paypal",
      name: "PayPal-supported route",
      type: "paypal",
      fee_fixed: 0,
      fee_percent: 5,
      fee_label: "estimate",
      requires: ["wallet_acceptance", "connectivity"],
      eligibility: "verified",
      estimated_minutes: 10,
    },
  ],
};
