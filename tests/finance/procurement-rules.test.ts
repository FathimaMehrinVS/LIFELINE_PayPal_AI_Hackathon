import { describe, expect, it } from "vitest";
import { getDemoRouteCatalogue, supplierCoversLocation } from "../../apps/api/src/modules/finance/route-catalogue";
import { canTransitionFulfilment } from "../../apps/api/src/rules/fulfilment";
import { determineRiskLevel } from "../../apps/api/src/rules/risk-level";

describe("local partner route", () => {
  it("needs no family payment access and is verified only with approved-area coverage", () => {
    const routeWithoutCoverage = getDemoRouteCatalogue().find((item) => item.id === "route_partner");
    const routeWithCoverage = getDemoRouteCatalogue(true).find((item) => item.id === "route_partner");

    expect(routeWithoutCoverage).toMatchObject({ type: "direct_merchant", requires: [], eligibility: "unverified", fee_label: "illustrative" });
    expect(routeWithCoverage).toMatchObject({ type: "direct_merchant", requires: [], eligibility: "verified" });
  });

  it("matches an exact normalized location area, not a substring", () => {
    expect(supplierCoversLocation("Kochi, Kerala", [" kerala "])).toBe(true);
    expect(supplierCoversLocation("Kochi", ["Kochi District"])).toBe(false);
  });
});

describe("fulfilment transitions", () => {
  it("allows sequential supplier updates but rejects skipped and recipient-confirmation moves", () => {
    expect(canTransitionFulfilment("AWAITING_ACCEPTANCE", "ACCEPTED", "SUPPLIER")).toBe(true);
    expect(canTransitionFulfilment("AWAITING_ACCEPTANCE", "READY", "SUPPLIER")).toBe(false);
    expect(canTransitionFulfilment("HANDED_OVER", "RECIPIENT_CONFIRMED", "SUPPLIER", { pickupCodeVerified: true })).toBe(false);
  });

  it("requires a verified pickup code and an NGO or recipient to confirm collection", () => {
    expect(canTransitionFulfilment("HANDED_OVER", "RECIPIENT_CONFIRMED", "NGO")).toBe(false);
    expect(canTransitionFulfilment("HANDED_OVER", "RECIPIENT_CONFIRMED", "NGO", { pickupCodeVerified: true })).toBe(true);
    expect(canTransitionFulfilment("HANDED_OVER", "RECIPIENT_CONFIRMED", "RECIPIENT", { pickupCodeVerified: true })).toBe(true);
  });
});

describe("case risk level", () => {
  it("marks high urgency as urgent only when remaining facts are nonessential", () => {
    expect(determineRiskLevel({ urgency: "CRITICAL", missingInformation: ["household_size"] })).toBe("URGENT");
    expect(determineRiskLevel({ urgency: "HIGH", missingInformation: ["location"] })).toBe("NORMAL");
  });

  it("holds suspended suppliers and conflicting payment details as high risk", () => {
    expect(determineRiskLevel({ urgency: "LOW", missingInformation: [], supplierStatus: "SUSPENDED" })).toBe("HIGH_RISK");
    expect(determineRiskLevel({ urgency: "LOW", missingInformation: [], conflictingPaymentDetails: true })).toBe("HIGH_RISK");
  });
});
