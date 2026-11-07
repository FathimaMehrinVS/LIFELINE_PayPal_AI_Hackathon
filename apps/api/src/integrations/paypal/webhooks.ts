import { env } from "../../config/env";
import { getPrisma } from "../../database/prisma";
import { Prisma } from "../../generated/prisma/client";
import { HttpError } from "../../utils/http-error";
import { paypal, type PaypalClient } from "./client";

export type PaypalTransmissionHeaders = {
  authAlgo: string;
  certUrl: string;
  transmissionId: string;
  transmissionSig: string;
  transmissionTime: string;
};

export type PaypalWebhookEvent = {
  id: string;
  event_type: string;
  resource?: {
    id?: unknown;
    status?: unknown;
    amount?: { value?: unknown; currency_code?: unknown };
    supplementary_data?: { related_ids?: { order_id?: unknown } };
  };
};

type VerificationResponse = { verification_status?: string };

export async function verifyPaypalWebhookSignature(
  rawBody: Buffer,
  headers: PaypalTransmissionHeaders,
  webhookId: string,
  client: PaypalClient = paypal,
): Promise<boolean> {
  if (env.PAYPAL_BASE_URL !== "https://api-m.sandbox.paypal.com") {
    throw new HttpError("INTERNAL_ERROR", "PayPal webhooks require PAYPAL_BASE_URL=https://api-m.sandbox.paypal.com");
  }

  // Embed the untouched webhook JSON as the webhook_event value in PayPal's verification request.
  const body = `{"auth_algo":${JSON.stringify(headers.authAlgo)},"cert_url":${JSON.stringify(headers.certUrl)},"transmission_id":${JSON.stringify(headers.transmissionId)},"transmission_sig":${JSON.stringify(headers.transmissionSig)},"transmission_time":${JSON.stringify(headers.transmissionTime)},"webhook_id":${JSON.stringify(webhookId)},"webhook_event":${rawBody.toString("utf8")}}`;
  const result = await client.paypalFetchRaw<VerificationResponse>("/v1/notifications/verify-webhook-signature", body);
  return result.verification_status === "SUCCESS";
}

function isEventIdConflict(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const candidate = error as { code?: unknown; meta?: { target?: unknown } };
  if (candidate.code !== "P2002") return false;
  const target = candidate.meta?.target;
  return target === "eventId" || (Array.isArray(target) && target.includes("eventId")) || (typeof target === "string" && target.includes("WebhookEvent_eventId_key"));
}

async function processDonationEvent(tx: Prisma.TransactionClient, event: PaypalWebhookEvent): Promise<void> {
  const resource = event.resource;
  if (!resource) return;

  if (event.event_type === "CHECKOUT.ORDER.APPROVED") {
    if (typeof resource.id !== "string") return;
    await tx.donation.updateMany({
      where: { paypalOrderId: resource.id, status: "CREATED" },
      data: { status: "APPROVED" },
    });
    return;
  }

  const orderId = resource.supplementary_data?.related_ids?.order_id;
  if (typeof orderId !== "string") return;

  if (event.event_type === "PAYMENT.CAPTURE.COMPLETED") {
    const captureId = resource.id;
    const amount = resource.amount;
    if (resource.status !== "COMPLETED" || typeof captureId !== "string" || !captureId ||
        typeof amount?.value !== "string" || !Number.isFinite(Number(amount.value)) ||
        typeof amount.currency_code !== "string") return;

    const donation = await tx.donation.findUnique({ where: { paypalOrderId: orderId } });
    if (!donation || donation.paypalOrderId !== orderId ||
        Number(amount.value) !== Number(donation.amount) || amount.currency_code !== donation.currency) return;

    await tx.donation.updateMany({
      where: { id: donation.id, status: { in: ["CREATED", "APPROVED"] } },
      data: { status: "CAPTURED", paypalCaptureId: captureId },
    });
    return;
  }

  if (event.event_type === "PAYMENT.CAPTURE.DENIED") {
    await tx.donation.updateMany({
      where: { paypalOrderId: orderId, status: { in: ["CREATED", "APPROVED"] } },
      data: { status: "FAILED" },
    });
  }
}

export async function processVerifiedPaypalEvent(
  event: PaypalWebhookEvent,
  getDatabase: typeof getPrisma = getPrisma,
): Promise<{ duplicate: boolean }> {
  if (typeof event.id !== "string" || !event.id || typeof event.event_type !== "string" || !event.event_type) {
    throw new HttpError("VALIDATION_ERROR", "Verified PayPal webhook is missing its event ID or type");
  }

  const db = getDatabase();
  try {
    return await db.$transaction(async (tx) => {
      const existing = await tx.webhookEvent.findUnique({ where: { eventId: event.id } });
      if (existing?.verified) return { duplicate: true };

      if (existing) {
        await tx.webhookEvent.update({
          where: { eventId: event.id },
          data: { eventType: event.event_type, verified: true, payload: event as never, processedAt: null },
        });
      } else {
        await tx.webhookEvent.create({
          data: { eventId: event.id, eventType: event.event_type, verified: true, payload: event as never },
        });
      }

      await processDonationEvent(tx, event);
      await tx.webhookEvent.update({ where: { eventId: event.id }, data: { processedAt: new Date() } });
      return { duplicate: false };
    });
  } catch (error) {
    if (!isEventIdConflict(error)) throw error;
    const existing = await db.webhookEvent.findUnique({ where: { eventId: event.id } });
    if (existing?.verified) return { duplicate: true };
    throw error;
  }
}
