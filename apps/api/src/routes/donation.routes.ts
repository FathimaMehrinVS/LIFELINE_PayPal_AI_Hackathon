import { Router } from "express";
import { CreateDonationRequestSchema } from "@lifeline/contracts";
import { env } from "../config/env";
import { getPrisma } from "../database/prisma";
import { captureDonationOrder, createDonationOrder } from "../integrations/paypal/orders";
import { validateBody } from "../middleware/validate";
import { HttpError } from "../utils/http-error";
import { Prisma } from "../generated/prisma/client";
import { getRequestSession } from "../auth/role-guard";
import type { AuthSession } from "../auth/session";
import type { Response } from "express";

// Owner: Member 3 (feature/commerce-payments). Mounted at /api/payments.
export function createDonationRouter(deps: {
  getPrisma?: typeof getPrisma;
  createOrder?: typeof createDonationOrder;
  captureOrder?: typeof captureDonationOrder;
  getSession?: (res: Response) => AuthSession;
} = {}) {
  const router = Router();
  const db = deps.getPrisma ?? getPrisma;
  const createOrder = deps.createOrder ?? createDonationOrder;
  const captureOrder = deps.captureOrder ?? captureDonationOrder;
  const getSession = deps.getSession ?? getRequestSession;

router.post("/donations", validateBody(CreateDonationRequestSchema), async (req, res) => {
  const session = getSession(res);
  const input = CreateDonationRequestSchema.parse(req.body);
  const prisma = db();
  const allocation = await prisma.aidAllocation.findUnique({
    where: { id: input.allocation_id },
    include: { campaign: true, request: true },
  });
  if (!allocation) throw new HttpError("NOT_FOUND", "Approved assistance allocation not found");
  if (allocation.status !== "APPROVED") {
    throw new HttpError("VALIDATION_ERROR", "Donations can only be created for an approved assistance allocation");
  }
  if (!allocation.request) {
    throw new HttpError("NOT_FOUND", "The allocation's assistance case was not found");
  }
  if (allocation.request.status !== "APPROVED") {
    throw new HttpError("VALIDATION_ERROR", "The assistance case is not approved for donations");
  }
  if (!allocation.campaign?.active) {
    throw new HttpError("NOT_FOUND", "The allocation's active campaign was not found");
  }
  if (!/^[A-Z]{3}$/.test(allocation.currency) || new Prisma.Decimal(allocation.amount).lessThanOrEqualTo(0)) {
    throw new HttpError("VALIDATION_ERROR", "The approved allocation has an invalid amount or currency");
  }
  if (allocation.currency !== allocation.campaign.currency || input.currency !== allocation.currency) {
    throw new HttpError("VALIDATION_ERROR", "Donation currency must match the approved allocation and campaign");
  }
  if (new Prisma.Decimal(input.amount).greaterThan(allocation.amount)) {
    throw new HttpError("VALIDATION_ERROR", "Donation amount cannot exceed the approved allocation amount");
  }

  const donationId = crypto.randomUUID();
  const returnUrl = `${env.WEB_ORIGIN}/donate/return?donation_id=${encodeURIComponent(donationId)}`;
  // `ccy` avoids PayPal's HTML handling of the `&curren` entity prefix in `&currency`.
  const cancelUrl = `${env.WEB_ORIGIN}/donate?donation_id=${encodeURIComponent(donationId)}&allocation_id=${encodeURIComponent(allocation.id)}&case_id=${encodeURIComponent(allocation.requestId)}&amount=${encodeURIComponent(allocation.amount.toString())}&ccy=${encodeURIComponent(allocation.currency)}&state=cancelled`;
  const order = await createOrder({ donationId, amount: input.amount, currency: input.currency, returnUrl, cancelUrl });
  const donation = await prisma.donation.create({
    data: {
      id: donationId,
      campaignId: allocation.campaignId,
      donorId: session.id,
      allocationId: allocation.id,
      amount: input.amount.toFixed(2),
      currency: input.currency,
      status: "CREATED",
      paypalOrderId: order.orderId,
    },
  });
  res.status(201).json({
    donation_id: donation.id,
    allocation_id: donation.allocationId ?? undefined,
    paypal_order_id: donation.paypalOrderId,
    status: "created",
    amount: Number(donation.amount),
    currency: donation.currency,
    approval_url: order.approvalUrl,
  });
});

router.post("/donations/:id/cancel", async (req, res) => {
  const session = getSession(res);
  const prisma = db();
  const donation = await prisma.donation.findUnique({ where: { id: req.params.id } });
  if (!donation) throw new HttpError("NOT_FOUND", "Donation not found");
  if (session.role !== "NGO" && donation.donorId !== session.id) throw new HttpError("NOT_FOUND", "Donation not found");

  // A browser return is only an abandonment signal. A verified PayPal capture can
  // still move CANCELLED to CAPTURED if PayPal confirms that payment completed.
  if (donation.status === "CREATED" || donation.status === "APPROVED") {
    const updated = await prisma.donation.updateMany({
      where: { id: donation.id, status: { in: ["CREATED", "APPROVED"] } },
      data: { status: "CANCELLED" },
    });
    if (updated.count === 0) {
      const current = await prisma.donation.findUnique({ where: { id: donation.id } });
      if (!current) throw new HttpError("NOT_FOUND", "Donation not found");
      res.json({ donation_id: current.id, allocation_id: current.allocationId ?? undefined, paypal_order_id: current.paypalOrderId, paypal_capture_id: current.paypalCaptureId ?? undefined, status: current.status.toLowerCase(), amount: Number(current.amount), currency: current.currency });
      return;
    }
  }

  res.json({ donation_id: donation.id, allocation_id: donation.allocationId ?? undefined, paypal_order_id: donation.paypalOrderId, paypal_capture_id: donation.paypalCaptureId ?? undefined, status: donation.status === "CREATED" || donation.status === "APPROVED" ? "cancelled" : donation.status.toLowerCase(), amount: Number(donation.amount), currency: donation.currency });
});

router.post("/donations/:id/capture", async (req, res) => {
  const session = getSession(res);
  const prisma = db();
  const donation = await prisma.donation.findUnique({ where: { id: req.params.id } });
  if (!donation) throw new HttpError("NOT_FOUND", "Donation not found");
  if (session.role !== "NGO" && donation.donorId !== session.id) throw new HttpError("NOT_FOUND", "Donation not found");
  if (donation.status === "CAPTURED") {
    res.json({ donation_id: donation.id, allocation_id: donation.allocationId ?? undefined, paypal_order_id: donation.paypalOrderId, paypal_capture_id: donation.paypalCaptureId ?? undefined, status: "captured", amount: Number(donation.amount), currency: donation.currency });
    return;
  }
  if (donation.status !== "CREATED" && donation.status !== "APPROVED" && donation.status !== "CANCELLED") throw new HttpError("VALIDATION_ERROR", `Donation cannot be captured from status ${donation.status}`);

  const capture = await captureOrder(donation.paypalOrderId);
  if (capture.orderId !== donation.paypalOrderId || capture.status !== "COMPLETED" || !capture.captureId) throw new HttpError("UPSTREAM_ERROR", "PayPal has not confirmed a completed capture for this donation");
  if (!capture.amount || capture.amount.currency_code !== donation.currency || Number(capture.amount.value) !== Number(donation.amount)) {
    throw new HttpError("UPSTREAM_ERROR", "PayPal capture amount does not match the donation");
  }
  const updated = await prisma.donation.updateMany({
    where: { id: donation.id, status: { in: ["CREATED", "APPROVED", "CANCELLED"] } },
    data: { status: "CAPTURED", paypalCaptureId: capture.captureId },
  });
  if (updated.count === 0) {
    const current = await prisma.donation.findUnique({ where: { id: donation.id } });
    if (current?.status !== "CAPTURED") throw new HttpError("VALIDATION_ERROR", "Donation status changed while capture was in progress");
  }
  res.json({ donation_id: donation.id, allocation_id: donation.allocationId ?? undefined, paypal_order_id: donation.paypalOrderId, paypal_capture_id: capture.captureId, status: "captured", amount: Number(donation.amount), currency: donation.currency });
});
  return router;
}

export const donationRouter = createDonationRouter();
