import express from "express";
import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import { errorHandler } from "../../apps/api/src/middleware/error-handler";
import { createDonationRouter } from "../../apps/api/src/routes/donation.routes";
import { getPrisma } from "../../apps/api/src/database/prisma";

function setup(status = "CREATED") {
  const donation = { id: "don-1", campaignId: "camp_demo", amount: "10.00", currency: "EUR", status, paypalOrderId: "ORDER-1", paypalCaptureId: null };
  const prisma = {
    campaign: { findUnique: vi.fn().mockResolvedValue({ id: "camp_demo", currency: "EUR", active: true }) },
    donation: {
      create: vi.fn().mockImplementation(async ({ data }) => ({ ...data, id: data.id })),
      findUnique: vi.fn().mockResolvedValue(donation),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
  } as unknown as ReturnType<typeof getPrisma>;
  const app = express(); app.use(express.json());
  app.use("/api/payments", createDonationRouter({ getPrisma: () => prisma, createOrder: async () => ({ orderId: "ORDER-1", approvalUrl: "https://sandbox.test/approve" }), captureOrder: vi.fn().mockResolvedValue({ orderId: "ORDER-1", status: "COMPLETED", captureId: "CAP-1", amount: { value: "10.00", currency_code: "EUR" } }) }));
  app.use(errorHandler);
  return { app, prisma };
}

describe("donation routes", () => {
  it("creates a CREATED donation after a sandbox order and returns approval URL", async () => {
    const { app, prisma } = setup();
    const response = await request(app).post("/api/payments/donations").send({ campaign_id: "camp_demo", amount: 10, currency: "EUR" });
    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({ paypal_order_id: "ORDER-1", status: "created", approval_url: "https://sandbox.test/approve" });
    expect(prisma.donation.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: "CREATED", paypalOrderId: "ORDER-1" }) }));
  });

  it("stores the capture ID and transitions the donation to CAPTURED", async () => {
    const { app, prisma } = setup();
    const response = await request(app).post("/api/payments/donations/don-1/capture");
    expect(response.status).toBe(200);
    expect(response.body.status).toBe("captured");
    expect(response.body.paypal_capture_id).toBe("CAP-1");
    expect(prisma.donation.updateMany).toHaveBeenCalledWith(expect.objectContaining({ data: { status: "CAPTURED", paypalCaptureId: "CAP-1" } }));
  });

  it("never records a capture when PayPal did not complete it", async () => {
    const { app, prisma } = setup();
    const router = createDonationRouter({ getPrisma: () => prisma, captureOrder: async () => ({ orderId: "ORDER-1", status: "PENDING" }) });
    const failedApp = express(); failedApp.use(express.json()); failedApp.use("/api/payments", router); failedApp.use(errorHandler);
    const response = await request(failedApp).post("/api/payments/donations/don-1/capture");
    expect(response.status).toBe(502);
    expect(prisma.donation.updateMany).not.toHaveBeenCalled();
  });

  it.each([
    [{ orderId: "ORDER-OTHER", status: "COMPLETED", captureId: "CAP-1", amount: { value: "10.00", currency_code: "EUR" } }],
    [{ orderId: "ORDER-1", status: "COMPLETED", captureId: "CAP-1", amount: { value: "11.00", currency_code: "EUR" } }],
    [{ orderId: "ORDER-1", status: "COMPLETED", captureId: "CAP-1", amount: { value: "10.00", currency_code: "USD" } }],
  ])("does not capture a donation when PayPal order, amount or currency differs", async (capture) => {
    const { prisma } = setup();
    const app = express(); app.use(express.json());
    app.use("/api/payments", createDonationRouter({ getPrisma: () => prisma, captureOrder: async () => capture }));
    app.use(errorHandler);
    const response = await request(app).post("/api/payments/donations/don-1/capture");
    expect(response.status).toBe(502);
    expect(prisma.donation.updateMany).not.toHaveBeenCalled();
  });

  it("returns an already captured donation without capturing twice", async () => {
    const { prisma } = setup("CAPTURED");
    (prisma.donation.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({ id: "don-1", amount: "10.00", currency: "EUR", status: "CAPTURED", paypalOrderId: "ORDER-1", paypalCaptureId: "CAP-1" });
    const app = express(); app.use(express.json()); app.use("/api/payments", createDonationRouter({ getPrisma: () => prisma, captureOrder: vi.fn() })); app.use(errorHandler);
    const response = await request(app).post("/api/payments/donations/don-1/capture");
    expect(response.status).toBe(200); expect(response.body.status).toBe("captured"); expect(prisma.donation.updateMany).not.toHaveBeenCalled();
  });
});
