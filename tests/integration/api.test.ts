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
  ])("%s accepts the sample request (NOT_IMPLEMENTED until built)", async (path, file) => {
    const res = await request(app).post(path).send(sample(file));
    expect(res.status).toBe(501);
    expect(res.body.error.code).toBe("NOT_IMPLEMENTED");
  });

  it("returns NOT_FOUND for unknown routes", async () => {
    const res = await request(app).get("/api/unknown");
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("NOT_FOUND");
  });
});
