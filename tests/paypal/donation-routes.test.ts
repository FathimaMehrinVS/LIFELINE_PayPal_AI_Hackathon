import express from "express";
import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import { errorHandler } from "../../apps/api/src/middleware/error-handler";
import { createDonationRouter } from "../../apps/api/src/routes/donation.routes";
import { getPrisma } from "../../apps/api/src/database/prisma";

function setup(status = "CREATED") {
  const donation = { id: "don-1", campaignId: "camp_demo", allocationId: "allocation-1", amount: "10.00", currency: "EUR", status, paypalOrderId: "ORDER-1", paypalCaptureId: null };
  const allocation: {
    id: string; requestId: string; campaignId: string; amount: string; currency: string; status: string;
    campaign: { id: string; currency: string; active: boolean };
    request: { id: string; status: string } | null;
  } = {
    id: "allocation-1", requestId: "case-1", campaignId: "camp_demo", amount: "100.00", currency: "EUR", status: "APPROVED",
    campaign: { id: "camp_demo", currency: "EUR", active: true }, request: { id: "case-1", status: "APPROVED" },
  };
  const prisma = {
    aidAllocation: { findUnique: vi.fn().mockResolvedValue(allocation) },
    donation: {
      create: vi.fn().mockImplementation(async ({ data }) => ({ ...data, id: data.id })),
      findUnique: vi.fn().mockResolvedValue(donation),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
  } as unknown as ReturnType<typeof getPrisma>;
  const createOrder = vi.fn(async (_input: { donationId: string; amount: number; currency: string; returnUrl: string; cancelUrl: string }) => ({ orderId: "ORDER-1", approvalUrl: "https://sandbox.test/approve" }));
  const harness = express(); harness.use(express.json());
  harness.use("/api/payments", createDonationRouter({ getPrisma: () => prisma, createOrder, captureOrder: vi.fn().mockResolvedValue({ orderId: "ORDER-1", status: "COMPLETED", captureId: "CAP-1", amount: { value: "10.00", currency_code: "EUR" } }) }));
  harness.use(errorHandler);
  return { app: harness, prisma, allocation, createOrder };
}

describe("donation routes", () => {
  it("creates a CREATED donation linked to an approved allocation and returns the PayPal approval URL", async () => {
    const { app, prisma, createOrder } = setup();
    const response = await request(app).post("/api/payments/donations").send({ allocation_id: "allocation-1", amount: 10, currency: "EUR" });
    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({ allocation_id: "allocation-1", paypal_order_id: "ORDER-1", status: "created", approval_url: "https://sandbox.test/approve" });
    expect(prisma.donation.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ allocationId: "allocation-1", campaignId: "camp_demo", status: "CREATED", paypalOrderId: "ORDER-1" }) }));
    expect(createOrder).toHaveBeenCalledOnce();
    const cancelUrl = new URL(createOrder.mock.calls[0]![0].cancelUrl);
    expect(cancelUrl.searchParams.get("donation_id")).toBeTruthy();
    expect(cancelUrl.searchParams.get("ccy")).toBe("EUR");
    expect(cancelUrl.searchParams.has("currency")).toBe(false);
  });

  it("rejects a missing allocation before creating a PayPal order", async () => {
    const { app, prisma, createOrder } = setup();
    (prisma.aidAllocation.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    const response = await request(app).post("/api/payments/donations").send({ allocation_id: "missing", amount: 10, currency: "EUR" });
    expect(response.status).toBe(404);
    expect(createOrder).not.toHaveBeenCalled();
    expect(prisma.donation.create).not.toHaveBeenCalled();
  });

  it("rejects an allocation whose assistance case is missing", async () => {
    const { app, prisma, allocation, createOrder } = setup();
    allocation.request = null;
    const response = await request(app).post("/api/payments/donations").send({ allocation_id: "allocation-1", amount: 10, currency: "EUR" });
    expect(response.status).toBe(404);
    expect(response.body.error.message).toContain("assistance case");
    expect(createOrder).not.toHaveBeenCalled();
    expect(prisma.donation.create).not.toHaveBeenCalled();
  });

  it("rejects an unapproved allocation before creating a PayPal order", async () => {
    const { app, prisma, allocation, createOrder } = setup();
    allocation.status = "PROPOSED";
    const response = await request(app).post("/api/payments/donations").send({ allocation_id: "allocation-1", amount: 10, currency: "EUR" });
    expect(response.status).toBe(400);
    expect(response.body.error.message).toContain("approved");
    expect(createOrder).not.toHaveBeenCalled();
    expect(prisma.donation.create).not.toHaveBeenCalled();
  });

  it("rejects an amount above the approved allocation before creating a PayPal order", async () => {
    const { app, prisma, createOrder } = setup();
    const response = await request(app).post("/api/payments/donations").send({ allocation_id: "allocation-1", amount: 100.01, currency: "EUR" });
    expect(response.status).toBe(400);
    expect(response.body.error.message).toContain("cannot exceed");
    expect(createOrder).not.toHaveBeenCalled();
    expect(prisma.donation.create).not.toHaveBeenCalled();
  });

  it("rejects a currency mismatch before creating a PayPal order", async () => {
    const { app, prisma, createOrder } = setup();
    const response = await request(app).post("/api/payments/donations").send({ allocation_id: "allocation-1", amount: 10, currency: "USD" });
    expect(response.status).toBe(400);
    expect(response.body.error.message).toContain("currency");
    expect(createOrder).not.toHaveBeenCalled();
    expect(prisma.donation.create).not.toHaveBeenCalled();
  });

  it("rejects a campaign currency inconsistent with the approved allocation", async () => {
    const { app, allocation, createOrder } = setup();
    allocation.campaign.currency = "USD";
    const response = await request(app).post("/api/payments/donations").send({ allocation_id: "allocation-1", amount: 10, currency: "EUR" });
    expect(response.status).toBe(400);
    expect(createOrder).not.toHaveBeenCalled();
  });

  it("rejects an inactive campaign before creating a PayPal order", async () => {
    const { app, prisma, allocation, createOrder } = setup();
    allocation.campaign.active = false;
    const response = await request(app).post("/api/payments/donations").send({ allocation_id: "allocation-1", amount: 10, currency: "EUR" });
    expect(response.status).toBe(404);
    expect(createOrder).not.toHaveBeenCalled();
    expect(prisma.donation.create).not.toHaveBeenCalled();
  });

  it("stores the capture ID and transitions the donation to CAPTURED", async () => {
    const { app, prisma } = setup();
    const response = await request(app).post("/api/payments/donations/don-1/capture");
    expect(response.status).toBe(200);
    expect(response.body.status).toBe("captured");
    expect(response.body.paypal_capture_id).toBe("CAP-1");
    expect(response.body.allocation_id).toBe("allocation-1");
    expect(prisma.donation.updateMany).toHaveBeenCalledWith(expect.objectContaining({ data: { status: "CAPTURED", paypalCaptureId: "CAP-1" } }));
  });

  it("cancels only the donation identified by the cancellation route", async () => {
    const { app, prisma } = setup();
    const response = await request(app).post("/api/payments/donations/don-1/cancel");
    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ donation_id: "don-1", paypal_order_id: "ORDER-1", status: "cancelled" });
    expect(prisma.donation.updateMany).toHaveBeenCalledWith({
      where: { id: "don-1", status: { in: ["CREATED", "APPROVED"] } }, data: { status: "CANCELLED" },
    });
  });

  it("returns NOT_FOUND for a missing donation without updating any record", async () => {
    const { app, prisma } = setup();
    (prisma.donation.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    const response = await request(app).post("/api/payments/donations/missing/cancel");
    expect(response.status).toBe(404);
    expect(prisma.donation.updateMany).not.toHaveBeenCalled();
  });

  it("makes repeated cancellation idempotent", async () => {
    const { app, prisma } = setup("CANCELLED");
    const response = await request(app).post("/api/payments/donations/don-1/cancel");
    expect(response.status).toBe(200);
    expect(response.body.status).toBe("cancelled");
    expect(prisma.donation.updateMany).not.toHaveBeenCalled();
  });

  it("does not cancel a donation after capture", async () => {
    const { app, prisma } = setup("CAPTURED");
    const response = await request(app).post("/api/payments/donations/don-1/cancel");
    expect(response.status).toBe(200);
    expect(response.body.status).toBe("captured");
    expect(prisma.donation.updateMany).not.toHaveBeenCalled();
  });

  it("allows a verified PayPal capture to supersede a browser cancellation", async () => {
    const { app, prisma } = setup("CANCELLED");
    const response = await request(app).post("/api/payments/donations/don-1/capture");
    expect(response.status).toBe(200);
    expect(response.body.status).toBe("captured");
    expect(prisma.donation.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "don-1", status: { in: ["CREATED", "APPROVED", "CANCELLED"] } },
      data: { status: "CAPTURED", paypalCaptureId: "CAP-1" },
    }));
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
