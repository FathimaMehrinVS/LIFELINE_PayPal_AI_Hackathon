import { describe, expect, it } from "vitest";
import { evaluateRoutes } from "../../apps/api/src/modules/finance/finance.service";
import { fakeFinanceLlm, financeSample } from "./finance.fixtures";

describe("finance route ranking by usable value", () => {
  it("prefers more usable funds even when that route has a lower accessibility score", async () => {
    const request = {
      ...financeSample,
      access: { ...financeSample.access, bank_availability: "limited" as const },
      routes: [
        { ...financeSample.routes[0]!, fee_percent: 0 },
        { ...financeSample.routes[2]!, fee_percent: 5 },
      ],
    };
    const result = await evaluateRoutes(request, fakeFinanceLlm());

    expect(result.routes[0]!.accessibility.score).toBeLessThan(result.routes[1]!.accessibility.score);
    expect(result.routes[0]!.usable_value).toBeGreaterThan(result.routes[1]!.usable_value);
    expect(result.recommended_route_id).toBe("route_bank");
  });
});
