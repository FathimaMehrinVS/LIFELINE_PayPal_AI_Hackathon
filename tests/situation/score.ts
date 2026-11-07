import type { AccessFactorKey, SituationResult } from "@lifeline/contracts";
import type { SituationFixture } from "./fixtures";

// Owner: Member 1. Compares one Situation Agent result with a fixture's expectations.

const ACCESS_KEYS: AccessFactorKey[] = [
  "bank_availability",
  "atm_access",
  "wallet_acceptance",
  "cash_availability",
  "merchant_acceptance",
  "connectivity",
];

export interface FixtureScore {
  id: string;
  passed: number;
  total: number;
  /** Access factors the message didn't mention but the model set anyway. */
  hallucinated: AccessFactorKey[];
  failures: string[];
}

export function scoreResult(fixture: SituationFixture, result: SituationResult): FixtureScore {
  const failures: string[] = [];
  const hallucinated: AccessFactorKey[] = [];
  let total = 0;

  const check = (ok: boolean, message: string) => {
    total++;
    if (!ok) failures.push(message);
  };
  const { expect } = fixture;

  for (const need of expect.needs ?? []) {
    check(result.needs.includes(need), `needs: missing "${need}" (got ${result.needs.join(", ")})`);
  }
  if (expect.budget !== undefined) check(result.budget === expect.budget, `budget: ${result.budget}, expected ${expect.budget}`);
  if (expect.currency !== undefined) {
    check(result.currency === expect.currency, `currency: ${result.currency}, expected ${expect.currency}`);
  }
  if (expect.location !== undefined) {
    const same = result.location?.toLowerCase().includes(expect.location?.toLowerCase() ?? "") ?? false;
    check(expect.location === null ? result.location === null : same, `location: ${result.location}, expected ${expect.location}`);
  }
  if (expect.urgency) {
    check(expect.urgency.includes(result.urgency), `urgency: ${result.urgency}, expected ${expect.urgency.join(" or ")}`);
  }

  for (const key of ACCESS_KEYS) {
    const expected = expect.access[key] ?? "unknown";
    const actual = result.access[key];
    check(actual === expected, `${key}: ${actual}, expected ${expected}`);
    if (expected === "unknown" && actual !== "unknown") hallucinated.push(key);
  }

  return { id: fixture.id, passed: total - failures.length, total, hallucinated, failures };
}
