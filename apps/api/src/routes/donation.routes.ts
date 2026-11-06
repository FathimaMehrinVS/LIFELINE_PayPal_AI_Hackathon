import { Router } from "express";
import { CreateDonationRequestSchema } from "@lifeline/contracts";
import { env } from "../config/env";
import { getPrisma } from "../database/prisma";
import { captureDonationOrder, createDonationOrder } from "../integrations/paypal/orders";
import { validateBody } from "../middleware/validate";
import { HttpError } from "../utils/http-error";

// Owner: Member 3 (feature/commerce-payments). Mounted at /api/payments.
export function createDonationRouter(deps: {
  getPrisma?: typeof getPrisma;
  createOrder?: typeof createDonationOrder;
  captureOrder?: typeof captureDonationOrder;
} = {}) {
  const router = Router();
  const db = deps.getPrisma ?? getPrisma;
  const createOrder = deps.createOrder ?? createDonationOrder;
  const captureOrder = deps.captureOrder ?? captureDonationOrder;

router.post("/donations", validateBody(CreateDonationRequestSchema), async (req, res) => {
  const input = CreateDonationRequestSchema.parse(req.body);
  const prisma = db();
  const campaign = await prisma.campaign.findUnique({ where: { id: input.campaign_id } });
  if (!campaign?.active) throw new HttpError("NOT_FOUND", "Active campaign not found");
  if (campaign.currency !== input.currency) throw new HttpError("VALIDATION_ERROR", "Donation currency must match the campaign currency");

  const donationId = crypto.randomUUID();
  const returnUrl = `${env.WEB_ORIGIN}/donate/return?donation_id=${encodeURIComponent(donationId)}`;
  const cancelUrl = `${env.WEB_ORIGIN}/donate?state=cancelled`;
  const order = await createOrder({ donationId, amount: input.amount, currency: input.currency, returnUrl, cancelUrl });
  const donation = await prisma.donation.create({
    data: { id: donationId, campaignId: campaign.id, amount: input.amount.toFixed(2), currency: input.currency, status: "CREATED", paypalOrderId: order.orderId },
  });
  res.status(201).json({ donation_id: donation.id, paypal_order_id: donation.paypalOrderId, status: "created", amount: Number(donation.amount), currency: donation.currency, approval_url: order.approvalUrl });
});

router.post("/donations/:id/capture", async (req, res) => {
  const prisma = db();
  const donation = await prisma.donation.findUnique({ where: { id: req.params.id } });
  if (!donation) throw new HttpError("NOT_FOUND", "Donation not found");
  if (donation.status === "CAPTURED") {
    res.json({ donation_id: donation.id, paypal_order_id: donation.paypalOrderId, paypal_capture_id: donation.paypalCaptureId ?? undefined, status: "captured", amount: Number(donation.amount), currency: donation.currency });
    return;
  }
  if (donation.status !== "CREATED" && donation.status !== "APPROVED") throw new HttpError("VALIDATION_ERROR", `Donation cannot be captured from status ${donation.status}`);

  const capture = await captureOrder(donation.paypalOrderId);
  if (capture.orderId !== donation.paypalOrderId || capture.status !== "COMPLETED" || !capture.captureId) throw new HttpError("UPSTREAM_ERROR", "PayPal has not confirmed a completed capture for this donation");
  if (!capture.amount || capture.amount.currency_code !== donation.currency || Number(capture.amount.value) !== Number(donation.amount)) {
    throw new HttpError("UPSTREAM_ERROR", "PayPal capture amount does not match the donation");
  }
  const updated = await prisma.donation.updateMany({
    where: { id: donation.id, status: { in: ["CREATED", "APPROVED"] } },
    data: { status: "CAPTURED", paypalCaptureId: capture.captureId },
  });
  if (updated.count === 0) {
    const current = await prisma.donation.findUnique({ where: { id: donation.id } });
    if (current?.status !== "CAPTURED") throw new HttpError("VALIDATION_ERROR", "Donation status changed while capture was in progress");
  }
  res.json({ donation_id: donation.id, paypal_order_id: donation.paypalOrderId, paypal_capture_id: capture.captureId, status: "captured", amount: Number(donation.amount), currency: donation.currency });
});
  return router;
}

export const donationRouter = createDonationRouter();
