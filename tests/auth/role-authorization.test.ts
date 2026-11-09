import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "../../apps/api/src/app";
import type { AuthRole } from "../../apps/api/src/auth/session";

function appFor(role: AuthRole) {
  return createApp({ resolveSession: async () => ({ id: `${role.toLowerCase()}-profile`, email: `${role.toLowerCase()}@example.test`, role }) });
}

describe("application role authorization", () => {
  it("returns 401 before protected work when authentication is missing", async () => {
    const response = await request(createApp()).post("/api/allocations/approve").send({});
    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe("AUTHENTICATION_REQUIRED");
  });

  it.each(["DONOR", "PARTNER"] as const)("rejects %s from full case review", async (role) => {
    const response = await request(appFor(role)).get("/api/cases");
    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe("FORBIDDEN");
  });

  it.each(["DONOR", "PARTNER"] as const)("rejects %s from allocation approval and disbursement", async (role) => {
    const app = appFor(role);
    const approval = await request(app).post("/api/allocations/approve").send({});
    const payout = await request(app).post("/api/payments/payouts").send({});
    expect(approval.status).toBe(403);
    expect(payout.status).toBe(403);
  });

  it("allows a donor payment request to reach validation but rejects a partner before payment work", async () => {
    const donorResponse = await request(appFor("DONOR")).post("/api/payments/donations").send({});
    expect(donorResponse.status).toBe(400);
    expect(donorResponse.body.error.code).toBe("VALIDATION_ERROR");

    const partnerResponse = await request(appFor("PARTNER")).post("/api/payments/donations").send({});
    expect(partnerResponse.status).toBe(403);
    expect(partnerResponse.body.error.code).toBe("FORBIDDEN");
  });
});
