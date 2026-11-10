import { describe, expect, it } from "vitest";
import { evaluateRoutes } from "../../apps/api/src/modules/finance/finance.service";
import { financeSample } from "./finance.fixtures";

describe("finance sample evaluation", () => {
  it("blocks the bank, reviews the agent, and recommends PayPal with €285 usable", async () => {
    let calls = 0;
    const result = await evaluateRoutes(financeSample, {
      generateJson: async <T>() => {
        calls += 1;
        return { explanation: "PayPal leaves €285 usable." } as T;
      },
    });

    expect(calls).toBe(1);
    expect(result.recommended_route_id).toBe("route_paypal");
    expect(result.routes.map(({ route_id, verdict, usable_value }) => ({ route_id, verdict, usable_value }))).toEqual([
      { route_id: "route_bank", verdict: "block", usable_value: 294 },
      { route_id: "route_agent", verdict: "review", usable_value: 240 },
      { route_id: "route_paypal", verdict: "pass", usable_value: 285 },
      { route_id: "route_partner", verdict: "review", usable_value: 294 },
    ]);
    expect(result.explanation).toBe("PayPal leaves €285 usable.");
  });
});
