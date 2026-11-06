import { Router } from "express";
import { CreateDonationRequestSchema, CreatePayoutRequestSchema } from "@lifeline/contracts";
import { validateBody } from "../middleware/validate";
import { notImplemented } from "./not-implemented";

// Owner: Member 3 (feature/commerce-payments)
export const paymentRouter = Router();

paymentRouter.post("/donations", validateBody(CreateDonationRequestSchema), notImplemented("Donation order"));
paymentRouter.post("/donations/:id/capture", notImplemented("Donation capture"));
paymentRouter.post("/payouts", validateBody(CreatePayoutRequestSchema), notImplemented("Payout"));
paymentRouter.post("/webhooks/paypal", notImplemented("PayPal webhook"));
