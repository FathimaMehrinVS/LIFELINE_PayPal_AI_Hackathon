import type { Currency } from "@lifeline/contracts";
import { env } from "../../config/env";
import { HttpError } from "../../utils/http-error";
import { paypal, type PaypalClient } from "./client";

type OrderResponse = {
  id: string;
  status: string;
  links?: { rel: string; href: string; method?: string }[];
};

function assertSandbox() {
  if (env.PAYPAL_BASE_URL !== "https://api-m.sandbox.paypal.com") throw new HttpError("UPSTREAM_ERROR", "PayPal donation checkout requires PAYPAL_BASE_URL=https://api-m.sandbox.paypal.com");
}

export type PaypalCapture = {
  orderId: string;
  status: string;
  captureId?: string;
  amount?: { value: string; currency_code: string };
};

export async function createDonationOrder(input: { donationId: string; amount: number; currency: Currency; returnUrl: string; cancelUrl: string }, client: PaypalClient = paypal) {
  assertSandbox();
  const order = await client.paypalFetch<OrderResponse>("/v2/checkout/orders", {
    method: "POST",
    headers: { "PayPal-Request-Id": input.donationId },
    body: {
      intent: "CAPTURE",
      purchase_units: [{ reference_id: input.donationId, custom_id: input.donationId, amount: { currency_code: input.currency, value: input.amount.toFixed(2) } }],
      application_context: { user_action: "PAY_NOW", shipping_preference: "NO_SHIPPING", return_url: input.returnUrl, cancel_url: input.cancelUrl },
    },
  });
  const approvalUrl = order.links?.find((link) => link.rel === "approve" || link.rel === "payer-action")?.href;
  if (!order.id || !approvalUrl) throw new HttpError("UPSTREAM_ERROR", "PayPal order response is missing its ID or approval link");
  return { orderId: order.id, approvalUrl };
}

export async function captureDonationOrder(orderId: string, client: PaypalClient = paypal): Promise<PaypalCapture> {
  assertSandbox();
  const order = await client.paypalFetch<{
    id: string;
    status: string;
    purchase_units?: { payments?: { captures?: { id: string; status: string; amount?: { value: string; currency_code: string } }[] } }[];
  }>(`/v2/checkout/orders/${encodeURIComponent(orderId)}/capture`, { method: "POST", headers: { "PayPal-Request-Id": `capture-${orderId}` }, body: {} });
  const capture = order.purchase_units?.flatMap((unit) => unit.payments?.captures ?? []).find((item) => item.status === "COMPLETED");
  return { orderId: order.id, status: order.status, captureId: capture?.id, amount: capture?.amount };
}
