import { describe, expect, it } from "vitest";
import { evaluateRoutes } from "../../apps/api/src/modules/finance/finance.service";
import { financeSample } from "./finance.fixtures";

describe("finance explanation fallback without a recommendation", () => {
  it("returns null when every route is blocked and still explains the result", async () => {
    const request = {
      ...financeSample,
      access: { ...financeSample.access, wallet_acceptance: "unavailable" as const, connectivity: "unavailable" as const },
      routes: [financeSample.routes[2]!],
    };
    const result = await evaluateRoutes(request, {
      generateJson: async <T>() => {
        throw new Error("LLM unavailable");
      },
    });

    expect(result.recommended_route_id).toBeNull();
    expect(result.routes[0]!.verdict).toBe("block");
    expect(result.explanation).toContain("No route passed");
  });
});
