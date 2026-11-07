import express, { Router, type Express } from "express";
import { env } from "../config/env";
import { getPrisma } from "../database/prisma";
import { processVerifiedPaypalEvent, verifyPaypalWebhookSignature, type PaypalTransmissionHeaders } from "../integrations/paypal/webhooks";
import { HttpError } from "../utils/http-error";

const WEBHOOK_PATH = "/api/payments/webhooks/paypal";

export function createPaypalWebhookRouter(deps: {
  getPrisma?: typeof getPrisma;
  getWebhookId?: () => string | undefined;
  verifySignature?: typeof verifyPaypalWebhookSignature;
} = {}) {
  const router = Router();
  const db = deps.getPrisma ?? getPrisma;
  const getWebhookId = deps.getWebhookId ?? (() => env.PAYPAL_WEBHOOK_ID);
  const verifySignature = deps.verifySignature ?? verifyPaypalWebhookSignature;

  router.post("/", async (req, res) => {
    const webhookId = getWebhookId();
    if (!webhookId) throw new HttpError("INTERNAL_ERROR", "PayPal webhooks require PAYPAL_WEBHOOK_ID to be configured");
    if (!Buffer.isBuffer(req.body)) throw new HttpError("VALIDATION_ERROR", "PayPal webhook body must be application/json");

    const headerNames = {
      authAlgo: "paypal-auth-algo",
      certUrl: "paypal-cert-url",
      transmissionId: "paypal-transmission-id",
      transmissionSig: "paypal-transmission-sig",
      transmissionTime: "paypal-transmission-time",
    } as const;
    const values = Object.fromEntries(Object.entries(headerNames).map(([key, header]) => [key, req.get(header)])) as Record<keyof PaypalTransmissionHeaders, string | undefined>;
    const missing = Object.entries(values).filter(([, value]) => !value?.trim()).map(([key]) => key);
    if (missing.length) throw new HttpError("VALIDATION_ERROR", "PayPal webhook is missing transmission headers", { missing });

    const headers = values as PaypalTransmissionHeaders;
    const verified = await verifySignature(req.body, headers, webhookId);
    if (!verified) throw new HttpError("VALIDATION_ERROR", "PayPal webhook signature verification failed");

    let event: unknown;
    try {
      event = JSON.parse(req.body.toString("utf8"));
    } catch {
      throw new HttpError("VALIDATION_ERROR", "Verified PayPal webhook body is not valid JSON");
    }
    if (!event || typeof event !== "object" || Array.isArray(event)) {
      throw new HttpError("VALIDATION_ERROR", "Verified PayPal webhook body must be a JSON object");
    }

    const result = await processVerifiedPaypalEvent(event as Parameters<typeof processVerifiedPaypalEvent>[0], db);
    res.status(200).json({ status: "received", duplicate: result.duplicate });
  });

  return router;
}

/** Mount before express.json so the webhook verifier receives the original request bytes. */
export function mountPaypalWebhookRoute(app: Express, router = createPaypalWebhookRouter()) {
  app.use(WEBHOOK_PATH, express.raw({ type: "application/json", limit: "1mb" }), router);
}
