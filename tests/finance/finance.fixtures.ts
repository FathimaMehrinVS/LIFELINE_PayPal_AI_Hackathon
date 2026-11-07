import type { FinanceRequest } from "@lifeline/contracts";
import type { LlmClient } from "../../apps/api/src/ai/llm-client";
import { getDemoRouteCatalogue } from "../../apps/api/src/modules/finance/route-catalogue";

export const financeSample: FinanceRequest = {
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
  routes: getDemoRouteCatalogue(),
};

export function fakeFinanceLlm(explanation = "Calculated routes are ready for review."): LlmClient {
  return {
    generateJson: async <T>() => ({ explanation }) as T,
  };
}
