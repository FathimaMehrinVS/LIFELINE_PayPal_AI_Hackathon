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
    expect(result.explanation).toContain("PayPal-supported route is recommended");
    expect(result.explanation).toContain("an illustrative fee of EUR 15.00");
    expect(result.explanation).toContain("EUR 285.00 usable");
    expect(result.explanation).toContain("Bank transfer was blocked");
    expect(result.explanation).not.toContain(".;");
    expect(result.explanation).not.toContain("..");
  });
});
