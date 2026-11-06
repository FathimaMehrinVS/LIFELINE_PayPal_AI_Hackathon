import { type SituationResult, SituationRequestSchema } from "@lifeline/contracts";
import { describe, expect, it } from "vitest";
import { SITUATION_FIXTURES } from "./fixtures";
import { scoreResult } from "./score";

// No network: checks the fixtures themselves and the scoring used by evaluate.ts.

describe("situation fixtures", () => {
  it.each(SITUATION_FIXTURES.map((f) => [f.id, f] as const))("%s is a valid request", (_id, fixture) => {
    expect(SituationRequestSchema.safeParse(fixture.input).success).toBe(true);
  });

  it("have unique ids", () => {
    const ids = SITUATION_FIXTURES.map((f) => f.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("scoreResult", () => {
  const fixture = SITUATION_FIXTURES.find((f) => f.id === "bank-works-atm-empty")!;
  const correct: SituationResult = {
    summary: "...",
    needs: ["food", "baby_supplies"],
    budget: 150,
    currency: "EUR",
    location: null,
    urgency: "high",
    access: {
      bank_availability: "available",
      atm_access: "unavailable",
      wallet_acceptance: "unknown",
      cash_availability: "unknown",
      merchant_acceptance: "unknown",
      connectivity: "unknown",
    },
    missing_information: [],
    confidence: 0.9,
  };

  it("passes a correct result", () => {
    expect(scoreResult(fixture, correct).failures).toEqual([]);
  });

  it("counts an unmentioned access factor as hallucinated", () => {
    const guessed = { ...correct, access: { ...correct.access, cash_availability: "available" as const } };
    const score = scoreResult(fixture, guessed);
    expect(score.hallucinated).toEqual(["cash_availability"]);
    expect(score.failures).toHaveLength(1);
  });

  it("reports a missing need and a wrong budget", () => {
    const score = scoreResult(fixture, { ...correct, needs: ["food"], budget: 15 });
    expect(score.failures).toHaveLength(2);
  });
});
