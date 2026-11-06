import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "../../apps/api/src/app";

const app = createApp();

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

  it("returns NOT_IMPLEMENTED for valid requests until the module is built", async () => {
    const res = await request(app)
      .post("/api/situation/analyze")
      .send({ message: "My family needs food and medicine.", currency: "INR" });
    expect(res.status).toBe(501);
    expect(res.body.error.code).toBe("NOT_IMPLEMENTED");
  });

  it("returns NOT_FOUND for unknown routes", async () => {
    const res = await request(app).get("/api/unknown");
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("NOT_FOUND");
  });
});
