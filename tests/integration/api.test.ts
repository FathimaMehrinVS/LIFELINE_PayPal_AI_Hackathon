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

  it("rejects bodies that break the contract with VALIDATION_ERROR", async () => {
    const res = await request(app).post("/api/situation/analyze").send({ message: "" });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });

  it.each([
    ["/api/situation/analyze", "situation-request.json"],
    ["/api/finance/evaluate", "finance-request.json"],
    ["/api/commerce/basket", "commerce-request.json"],
    ["/api/cases", "situation-request.json"],
  ])("%s accepts the sample request", async (path, file) => {
    // Only checks that the sample passes validation, so this stays true before and after each module is built.
    // Tests never load .env, so a built module answers 502 (no LLM configured) here instead of calling it.
    const res = await request(app).post(path).send(sample(file));
    expect(res.status).not.toBe(400);
  });

  it.each([
    ["/api/allocations/approve", { case_id: "case_1", campaign_id: "camp_demo", amount: 285, currency: "EUR" }],
    ["/api/payments/donations", { campaign_id: "camp_demo", amount: 300, currency: "EUR" }],
    ["/api/payments/donations/don_1/capture", undefined],
    ["/api/payments/payouts", { allocation_id: "alloc_1", amount: 285, currency: "EUR" }],
    ["/api/payments/webhooks/paypal", {}],
  ])("%s is mounted (NOT_IMPLEMENTED until built)", async (path, body) => {
    const res = await request(app).post(path).send(body);
    expect(res.status).toBe(501);
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
