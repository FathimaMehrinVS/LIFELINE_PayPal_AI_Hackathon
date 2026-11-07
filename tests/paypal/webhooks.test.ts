import express from "express";
import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import type { PaypalClient } from "../../apps/api/src/integrations/paypal/client";
import { verifyPaypalWebhookSignature, type PaypalTransmissionHeaders } from "../../apps/api/src/integrations/paypal/webhooks";
import { errorHandler } from "../../apps/api/src/middleware/error-handler";
import { createPaypalWebhookRouter, mountPaypalWebhookRoute } from "../../apps/api/src/routes/paypal-webhook.routes";
import { HttpError } from "../../apps/api/src/utils/http-error";
import type { getPrisma } from "../../apps/api/src/database/prisma";

const headers: Record<string, string> = {
  "paypal-auth-algo": "SHA256withRSA",
  "paypal-cert-url": "https://api-m.sandbox.paypal.com/cert",
  "paypal-transmission-id": "transmission-1",
  "paypal-transmission-sig": "signature-test",
  "paypal-transmission-time": "2026-11-07T10:00:00Z",
};

const webhookHeaders: PaypalTransmissionHeaders = {
  authAlgo: headers["paypal-auth-algo"]!,
  certUrl: headers["paypal-cert-url"]!,
  transmissionId: headers["paypal-transmission-id"]!,
  transmissionSig: headers["paypal-transmission-sig"]!,
  transmissionTime: headers["paypal-transmission-time"]!,
};

function setup(status = "CREATED", verifySignature = vi.fn().mockResolvedValue(true)) {
  const donation: any = { id: "don-1", amount: "10.00", currency: "EUR", status, paypalOrderId: "ORDER-1", paypalCaptureId: null };
  const eventRows = new Map<string, any>();
  const tx: any = {
    webhookEvent: {
      findUnique: vi.fn(async ({ where }: any) => eventRows.get(where.eventId) ?? null),
      create: vi.fn(async ({ data }: any) => {
        const row = { ...data, processedAt: null };
        eventRows.set(data.eventId, row);
        return row;
      }),
      update: vi.fn(async ({ where, data }: any) => {
        const row = { ...eventRows.get(where.eventId), ...data };
        eventRows.set(where.eventId, row);
        return row;
      }),
    },
    donation: {
      findUnique: vi.fn(async ({ where }: any) => where.paypalOrderId === donation.paypalOrderId ? { ...donation } : null),
      updateMany: vi.fn(async ({ where, data }: any) => {
        const statusMatches = typeof where.status === "string"
          ? donation.status === where.status
          : !where.status?.in || where.status.in.includes(donation.status);
        if ((!where.id || where.id === donation.id) && (!where.paypalOrderId || where.paypalOrderId === donation.paypalOrderId) && statusMatches) {
          Object.assign(donation, data);
          return { count: 1 };
        }
        return { count: 0 };
      }),
    },
  };
  const prisma = { ...tx, $transaction: vi.fn(async (callback: (transaction: any) => unknown) => callback(tx)) };
  const getDatabase = vi.fn(() => prisma as unknown as ReturnType<typeof getPrisma>);
  const app = express();
  mountPaypalWebhookRoute(app, createPaypalWebhookRouter({
    getPrisma: getDatabase,
    getWebhookId: () => "WEBHOOK-SANDBOX-1",
    verifySignature,
  }));
  app.use(express.json({ limit: "1mb" }));
  app.use(errorHandler);
  return { app, donation, prisma, eventRows, getDatabase, verifySignature };
}

const event = (eventType: string, resource: Record<string, unknown> = {}, id = "EVENT-1") => ({ id, event_type: eventType, resource });
const completedCapture = (overrides: Record<string, unknown> = {}) => event("PAYMENT.CAPTURE.COMPLETED", {
  id: "CAPTURE-1",
  status: "COMPLETED",
  amount: { value: "10.00", currency_code: "EUR" },
  supplementary_data: { related_ids: { order_id: "ORDER-1" } },
  ...overrides,
});
const postEvent = (app: express.Express, body: unknown, requestHeaders: Record<string, string> = headers) =>
  request(app).post("/api/payments/webhooks/paypal").set("Content-Type", "application/json").set(requestHeaders).send(JSON.stringify(body));

describe("PayPal webhook verification and processing", () => {
  it("fails closed when PAYPAL_WEBHOOK_ID is missing", async () => {
    const verifySignature = vi.fn();
    const harness = setup("CREATED", verifySignature);
    const app = express();
    mountPaypalWebhookRoute(app, createPaypalWebhookRouter({ getPrisma: harness.getDatabase, getWebhookId: () => undefined, verifySignature }));
    app.use(errorHandler);

    const response = await postEvent(app, event("CHECKOUT.ORDER.APPROVED", { id: "ORDER-1" }));
    expect(response.status).toBe(500);
    expect(verifySignature).not.toHaveBeenCalled();
    expect(harness.getDatabase).not.toHaveBeenCalled();
  });

  it("rejects missing PayPal transmission headers before verification", async () => {
    const harness = setup();
    const incompleteHeaders = { ...headers };
    delete incompleteHeaders["paypal-transmission-sig"];
    const response = await postEvent(harness.app, event("CHECKOUT.ORDER.APPROVED", { id: "ORDER-1" }), incompleteHeaders);
    expect(response.status).toBe(400);
    expect(harness.verifySignature).not.toHaveBeenCalled();
    expect(harness.getDatabase).not.toHaveBeenCalled();
  });

  it("does not mutate the database when verification fails", async () => {
    const verifySignature = vi.fn().mockRejectedValue(new HttpError("UPSTREAM_ERROR", "PayPal signature verification request failed"));
    const harness = setup("CREATED", verifySignature);
    const response = await postEvent(harness.app, event("CHECKOUT.ORDER.APPROVED", { id: "ORDER-1" }));
    expect(response.status).toBe(502);
    expect(harness.getDatabase).not.toHaveBeenCalled();
  });

  it("does not mutate the database when PayPal returns an unsuccessful verification status", async () => {
    const verifySignature = vi.fn().mockResolvedValue(false);
    const harness = setup("CREATED", verifySignature);
    const response = await postEvent(harness.app, event("CHECKOUT.ORDER.APPROVED", { id: "ORDER-1" }));
    expect(response.status).toBe(400);
    expect(response.body.error.message).toContain("signature verification failed");
    expect(harness.getDatabase).not.toHaveBeenCalled();
  });

  it("records an unknown event only after successful verification", async () => {
    const harness = setup();
    const payload = event("UNHANDLED.EVENT", { value: "ignored" });
    const response = await postEvent(harness.app, payload);
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: "received", duplicate: false });
    expect(harness.eventRows.get("EVENT-1")).toMatchObject({ eventId: "EVENT-1", eventType: "UNHANDLED.EVENT", verified: true, payload });
    expect(harness.eventRows.get("EVENT-1").processedAt).toBeInstanceOf(Date);
  });

  it("transitions a matching donation from CREATED to APPROVED", async () => {
    const harness = setup();
    const response = await postEvent(harness.app, event("CHECKOUT.ORDER.APPROVED", { id: "ORDER-1" }));
    expect(response.status).toBe(200);
    expect(harness.donation.status).toBe("APPROVED");
    expect(harness.prisma.donation.updateMany).toHaveBeenCalledWith({
      where: { paypalOrderId: "ORDER-1", status: "CREATED" }, data: { status: "APPROVED" },
    });
  });

  it.each(["CREATED", "APPROVED"]) ("validates and stores a completed capture from %s", async (status) => {
    const harness = setup(status);
    const response = await postEvent(harness.app, completedCapture());
    expect(response.status).toBe(200);
    expect(harness.donation).toMatchObject({ status: "CAPTURED", paypalCaptureId: "CAPTURE-1" });
    expect(harness.prisma.donation.updateMany).toHaveBeenCalledWith({
      where: { id: "don-1", status: { in: ["CREATED", "APPROVED"] } },
      data: { status: "CAPTURED", paypalCaptureId: "CAPTURE-1" },
    });
  });

  it.each([
    ["amount", { amount: { value: "11.00", currency_code: "EUR" } }],
    ["currency", { amount: { value: "10.00", currency_code: "USD" } }],
    ["order ID", { supplementary_data: { related_ids: { order_id: "ORDER-OTHER" } } }],
  ])("does not capture when the event %s mismatches", async (_reason, override) => {
    const harness = setup();
    const response = await postEvent(harness.app, completedCapture(override));
    expect(response.status).toBe(200);
    expect(harness.donation.status).toBe("CREATED");
    expect(harness.donation.paypalCaptureId).toBeNull();
    expect(harness.prisma.donation.updateMany).not.toHaveBeenCalled();
  });

  it.each(["CREATED", "APPROVED"]) ("transitions a matching %s donation to FAILED on capture denial", async (status) => {
    const harness = setup(status);
    const denied = event("PAYMENT.CAPTURE.DENIED", { id: "CAPTURE-DENIED", supplementary_data: { related_ids: { order_id: "ORDER-1" } } });
    const response = await postEvent(harness.app, denied);
    expect(response.status).toBe(200);
    expect(harness.donation.status).toBe("FAILED");
  });

  it("deduplicates repeated verified event IDs", async () => {
    const harness = setup();
    const payload = event("CHECKOUT.ORDER.APPROVED", { id: "ORDER-1" });
    const first = await postEvent(harness.app, payload);
    const second = await postEvent(harness.app, payload);
    expect(first.body.duplicate).toBe(false);
    expect(second.body.duplicate).toBe(true);
    expect(harness.donation.status).toBe("APPROVED");
    expect(harness.prisma.webhookEvent.create).toHaveBeenCalledOnce();
    expect(harness.prisma.donation.updateMany).toHaveBeenCalledOnce();
  });

  it.each(["CAPTURED", "FAILED", "CANCELLED", "REFUNDED"]) ("does not regress a %s donation on out-of-order approval or denial", async (status) => {
    const harness = setup(status);
    await postEvent(harness.app, event("CHECKOUT.ORDER.APPROVED", { id: "ORDER-1" }, "EVENT-APPROVED"));
    await postEvent(harness.app, event("PAYMENT.CAPTURE.DENIED", { supplementary_data: { related_ids: { order_id: "ORDER-1" } } }, "EVENT-DENIED"));
    expect(harness.donation.status).toBe(status);
    expect(harness.prisma.donation.updateMany).toHaveBeenCalledTimes(2);
    expect(harness.prisma.donation.updateMany.mock.calls[0]?.[0].where.status).toBe("CREATED");
    expect(harness.prisma.donation.updateMany.mock.calls[1]?.[0].where.status.in).toEqual(["CREATED", "APPROVED"]);
  });

  it("passes the exact raw request bytes to verification before parsing the event", async () => {
    const verifySignature = vi.fn().mockResolvedValue(true);
    const harness = setup("CREATED", verifySignature);
    const raw = '{\n  "id": "RAW-EVENT", "event_type": "UNHANDLED.EVENT", "resource": {}\n}';
    const response = await request(harness.app).post("/api/payments/webhooks/paypal").set("Content-Type", "application/json").set(headers).send(raw);
    expect(response.status).toBe(200);
    expect(verifySignature).toHaveBeenCalledWith(Buffer.from(raw), expect.any(Object), "WEBHOOK-SANDBOX-1");
    expect(harness.eventRows.get("RAW-EVENT")?.eventType).toBe("UNHANDLED.EVENT");
  });

  it("uses the existing PayPal client to verify an exact raw event body", async () => {
    const rawEvent = '{ "id":"RAW",\n"event_type":"UNHANDLED.EVENT" }';
    const paypalFetchRaw = vi.fn().mockResolvedValue({ verification_status: "SUCCESS" });
    const client = { paypalFetchRaw } as unknown as PaypalClient;
    await expect(verifyPaypalWebhookSignature(Buffer.from(rawEvent), webhookHeaders, "WEBHOOK-1", client)).resolves.toBe(true);
    expect(paypalFetchRaw).toHaveBeenCalledOnce();
    expect(paypalFetchRaw.mock.calls[0]?.[0]).toBe("/v1/notifications/verify-webhook-signature");
    expect(paypalFetchRaw.mock.calls[0]?.[1]).toContain(`"webhook_event":${rawEvent}}`);
  });

  it("rejects the verification endpoint's non-SUCCESS status", async () => {
    const paypalFetchRaw = vi.fn().mockResolvedValue({ verification_status: "FAILURE" });
    const client = { paypalFetchRaw } as unknown as PaypalClient;
    await expect(verifyPaypalWebhookSignature(Buffer.from("{}"), webhookHeaders, "WEBHOOK-1", client)).resolves.toBe(false);
  });
});
