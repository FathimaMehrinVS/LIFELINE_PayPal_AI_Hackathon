import { describe, expect, it } from "vitest";
import { canReceiveOrders, supplierScorecard } from "../../apps/api/src/rules/supplier-score";

describe("supplier scorecard", () => {
  it("has no score without finished orders", () => {
    expect(supplierScorecard({ completed: 0, issues: 0, openComplaints: 0 })).toMatchObject({ score: null, fulfilment_rate: null, orders_finished: 0 });
  });

  it("doesn't let one perfect order beat a long strong record", () => {
    const one = supplierScorecard({ completed: 1, issues: 0, openComplaints: 0 });
    const long = supplierScorecard({ completed: 95, issues: 5, openComplaints: 0 });
    expect(one.fulfilment_rate).toBe(100);
    expect(long.fulfilment_rate).toBe(95);
    expect(long.score!).toBeGreaterThan(one.score!);
  });

  it("lowers the score for open complaints, never below zero", () => {
    const clean = supplierScorecard({ completed: 20, issues: 0, openComplaints: 0 });
    const complained = supplierScorecard({ completed: 20, issues: 0, openComplaints: 2 });
    expect(complained.score!).toBeLessThan(clean.score!);
    expect(supplierScorecard({ completed: 0, issues: 1, openComplaints: 50 }).score).toBe(0);
  });

  it.each([["approved", true], ["pending", false], ["suspended", false]] as const)("%s can receive orders: %s", (status, expected) => {
    expect(canReceiveOrders(status)).toBe(expected);
  });
});
