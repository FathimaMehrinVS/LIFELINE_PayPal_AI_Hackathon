import express from "express";
import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import { createCommerceRouter } from "../../apps/api/src/routes/commerce.routes";
import { errorHandler } from "../../apps/api/src/middleware/error-handler";
import type { CommerceRequest, CommerceResult } from "@lifeline/contracts";

const sampleRequest: CommerceRequest = { needs: ["food"], budget: 20, currency: "EUR", location: "Demo", reserve_ratio: 0.2 };
const sampleResult: CommerceResult = { items: [], alternatives: [], total: 0, reserve: 20, currency: "EUR", unmet_needs: ["food"], explanation: "No matching product." };

describe("basket API route", () => {
  it("validates input and returns the service basket result", async () => {
    const build = vi.fn(async (_input: CommerceRequest) => sampleResult);
    const app = express(); app.use(express.json()); app.use("/api/commerce", createCommerceRouter(build)); app.use(errorHandler);
    const response = await request(app).post("/api/commerce/basket").send(sampleRequest);
    expect(response.status).toBe(201);
    expect(response.body).toEqual(sampleResult);
    expect(build).toHaveBeenCalledWith(sampleRequest);
  });

  it("rejects invalid basket request bodies before invoking the service", async () => {
    const build = vi.fn(async (_input: CommerceRequest) => sampleResult);
    const app = express(); app.use(express.json()); app.use("/api/commerce", createCommerceRouter(build)); app.use(errorHandler);
    const response = await request(app).post("/api/commerce/basket").send({ needs: [], budget: -1, currency: "EUR" });
    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("VALIDATION_ERROR");
    expect(build).not.toHaveBeenCalled();
  });
});
