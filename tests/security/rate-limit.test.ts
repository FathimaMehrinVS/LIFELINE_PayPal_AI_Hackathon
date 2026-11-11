import express from "express";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "../../apps/api/src/app";
import { errorHandler } from "../../apps/api/src/middleware/error-handler";
import { rateLimit } from "../../apps/api/src/middleware/rate-limit";

function limited(max: number) {
  const app = express();
  app.use(rateLimit({ name: "test", windowMs: 60_000, max }));
  app.get("/", (_req, res) => { res.json({ ok: true }); });
  app.use(errorHandler);
  return app;
}

describe("rate limits", () => {
  it("allows requests up to the limit, then answers 429 with a wait time", async () => {
    const app = limited(2);
    expect((await request(app).get("/")).status).toBe(200);
    expect((await request(app).get("/")).status).toBe(200);
    const blocked = await request(app).get("/");
    expect(blocked.status).toBe(429);
    expect(blocked.body.error.code).toBe("RATE_LIMITED");
    expect(Number(blocked.headers["retry-after"])).toBeGreaterThan(0);
  });

  it("limits report creation per account so one person can't use up the AI allowance", async () => {
    const app = createApp({ resolveSession: async () => ({ id: "donor-1", email: "d@example.test", role: "DONOR" }) });
    const statuses: number[] = [];
    for (let attempt = 0; attempt < 7; attempt += 1) statuses.push((await request(app).post("/api/cases").send({ message: "" })).status);
    expect(statuses.slice(0, 6).every((status) => status === 400)).toBe(true);
    expect(statuses[6]).toBe(429);
  });

  it("doesn't count reading the case list against the report limit", async () => {
    const app = createApp({ resolveSession: async () => ({ id: "ngo-1", email: "n@example.test", role: "NGO" }) });
    for (let attempt = 0; attempt < 8; attempt += 1) expect((await request(app).get("/api/cases/samples")).status).not.toBe(429);
  });
});

describe("security headers", () => {
  it("sends protective headers and hides the server framework", async () => {
    const res = await request(createApp()).get("/health");
    expect(res.headers["x-content-type-options"]).toBe("nosniff");
    expect(res.headers["x-frame-options"]).toBe("DENY");
    expect(res.headers["x-powered-by"]).toBeUndefined();
  });
});
