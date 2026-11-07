import { describe, expect, it } from "vitest";
import { evaluateRoutes } from "../../apps/api/src/modules/finance/finance.service";
import { fakeFinanceLlm, financeSample } from "./finance.fixtures";

describe("finance route ranking tie-break", () => {
  it("uses accessibility score when passing routes have equal usable value", async () => {
    const request = {
      ...financeSample,
      access: { ...financeSample.access, bank_availability: "limited" as const },
      routes: [
        { ...financeSample.routes[0]!, fee_percent: 5 },
        { ...financeSample.routes[2]!, fee_percent: 5 },
      ],
    };
    const result = await evaluateRoutes(request, fakeFinanceLlm());

    expect(result.routes[0]!.usable_value).toBe(result.routes[1]!.usable_value);
    expect(result.routes[0]!.accessibility.score).toBeLessThan(result.routes[1]!.accessibility.score);
    expect(result.recommended_route_id).toBe("route_paypal");
  });
});
