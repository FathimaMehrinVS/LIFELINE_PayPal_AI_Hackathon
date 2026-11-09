import { describe, expect, it } from "vitest";
import { parseDonationTarget } from "../../apps/web/app/(app)/donate/donation-target";

describe("donation target URL parsing", () => {
  it("parses the existing dashboard currency parameter", () => {
    expect(parseDonationTarget("?allocation_id=a1&case_id=c1&amount=50&currency=EUR")).toEqual({
      allocationId: "a1", caseId: "c1", amount: 50, currency: "EUR",
    });
  });

  it("parses the PayPal-safe ccy cancel parameter", () => {
    expect(parseDonationTarget("?allocation_id=a1&case_id=c1&amount=50&ccy=EUR&state=cancelled")).toEqual({
      allocationId: "a1", caseId: "c1", amount: 50, currency: "EUR",
    });
  });

  it("recovers a legacy PayPal URL that folded ¤cy=EUR into the amount", () => {
    expect(parseDonationTarget("?allocation_id=a1&case_id=c1&amount=50%C2%A4cy=EUR&state=cancelled")).toEqual({
      allocationId: "a1", caseId: "c1", amount: 50, currency: "EUR",
    });
  });
});
