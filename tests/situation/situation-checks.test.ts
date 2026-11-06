import type { SituationResult } from "@lifeline/contracts";
import { describe, expect, it } from "vitest";
import { applySituationChecks } from "../../apps/api/src/rules/situation-checks";

const base: SituationResult = {
  summary: "Parents need food and medicine.",
  needs: ["food", "medicine"],
  budget: 300,
  currency: "EUR",
  location: null,
  urgency: "high",
  access: {
    bank_availability: "unavailable",
    atm_access: "unknown",
    wallet_acceptance: "unknown",
    cash_availability: "unknown",
    merchant_acceptance: "unknown",
    connectivity: "limited",
  },
  missing_information: [],
  confidence: 0.85,
};

describe("applySituationChecks", () => {
  it("lists every null field and unknown access factor, even if the model forgot them", () => {
    const result = applySituationChecks(base, { message: "..." });
    expect(result.missing_information).toEqual([
      "location",
      "atm_access",
      "wallet_acceptance",
      "cash_availability",
      "merchant_acceptance",
    ]);
  });

  it("drops entries the model listed that are actually known or not real field names", () => {
    const raw = { ...base, missing_information: ["budget", "bank_availability", "local_merchant_availability"] };
    const result = applySituationChecks(raw, { message: "..." });
    expect(result.missing_information).not.toContain("budget");
    expect(result.missing_information).not.toContain("bank_availability");
    expect(result.missing_information).not.toContain("local_merchant_availability");
  });

  it("uses the form's currency and location when the model returned null", () => {
    const raw = { ...base, currency: null, location: null };
    const result = applySituationChecks(raw, { message: "...", currency: "INR", location: "Kerala" });
    expect(result.currency).toBe("INR");
    expect(result.location).toBe("Kerala");
    expect(result.missing_information).not.toContain("currency");
    expect(result.missing_information).not.toContain("location");
  });

  it("keeps the model's value over the form hint when both exist", () => {
    const result = applySituationChecks(base, { message: "...", currency: "USD" });
    expect(result.currency).toBe("EUR");
  });

  it("reports a missing budget and removes duplicate needs", () => {
    const raw: SituationResult = { ...base, budget: null, needs: ["food", "food", "water"] };
    const result = applySituationChecks(raw, { message: "..." });
    expect(result.needs).toEqual(["food", "water"]);
    expect(result.missing_information[0]).toBe("budget");
  });

  it("does not change the input object", () => {
    const raw = structuredClone(base);
    applySituationChecks(raw, { message: "...", location: "Kerala" });
    expect(raw).toEqual(base);
  });
});
