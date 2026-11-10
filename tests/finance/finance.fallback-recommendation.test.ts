import { describe, expect, it } from "vitest";
import { evaluateRoutes } from "../../apps/api/src/modules/finance/finance.service";
import { financeSample } from "./finance.fixtures";

describe("finance explanation fallback with a recommendation", () => {
  it("explains the deterministic result when the LLM is unavailable", async () => {
    const result = await evaluateRoutes(financeSample, {
      generateJson: async <T>() => {
        throw new Error("LLM unavailable");
      },
    });

    expect(result.recommended_route_id).toBe("route_paypal");
    expect(result.explanation).toContain("We recommend PayPal-supported route");
    expect(result.explanation).toContain("illustrative fee is EUR 15.00");
    expect(result.explanation).toContain("leaving EUR 285.00 for the family");
    expect(result.explanation).not.toMatch(/flags|deterministic|eligibility|route_paypal|score|blocked/i);
    expect(result.explanation).not.toContain(".;");
    expect(result.explanation).not.toContain("..");
  });
});
