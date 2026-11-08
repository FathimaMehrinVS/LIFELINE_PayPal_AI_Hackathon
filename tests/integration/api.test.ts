import { readFileSync } from "node:fs";
import { join } from "node:path";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "../../apps/api/src/app";

const app = createApp();
const sample = (file: string) =>
  JSON.parse(readFileSync(join(import.meta.dirname, "../../packages/contracts/samples", file), "utf8"));

describe("API foundation", () => {
  it("responds to /health", async () => {
    const res = await request(app).get("/health");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: "ok" });
  });

  it("rejects unauthenticated GET /api/auth/me", async () => {
    const res = await request(app).get("/api/auth/me");
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("AUTHENTICATION_REQUIRED");
  });

  it("rejects bodies that break the contract with VALIDATION_ERROR", async () => {
    const res = await request(app).post("/api/situation/analyze").send({ message: "" });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });

  it.each([
    ["/api/situation/analyze", "situation-request.json"],
    ["/api/finance/evaluate", "finance-request.json"],
    ["/api/cases", "situation-request.json"],
  ])("%s accepts the sample request", async (path, file) => {
    // Only checks that the sample passes validation, so this stays true before and after each module is built.
    // Tests never load .env, so a built module answers 502 (no LLM configured) here instead of calling it.
    const res = await request(app).post(path).send(sample(file));
    expect(res.status).not.toBe(400);
  });

  it("validates allocation approval requests before database access", async () => {
    const res = await request(app).post("/api/allocations/approve").send({
      case_id: "case_1", campaign_id: "camp_demo", amount: 0, currency: "EUR",
    });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("validates simulated payout requests before database access", async () => {
    const res = await request(app).post("/api/payments/payouts").send({ allocation_id: "alloc_1", amount: 0, currency: "EUR" });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("mounts the PayPal webhook and fails closed when its server configuration is missing", async () => {
    const res = await request(app).post("/api/payments/webhooks/paypal").set("Content-Type", "application/json").send("{}");
    expect(res.status).toBe(500);
    expect(res.body.error.message).toContain("PAYPAL_WEBHOOK_ID");
  });

  it("GET /api/cases lists cases", async () => {
    const res = await request(app).get("/api/cases");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it("returns NOT_FOUND for unknown routes", async () => {
    const res = await request(app).get("/api/unknown");
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("NOT_FOUND");
  });
});
