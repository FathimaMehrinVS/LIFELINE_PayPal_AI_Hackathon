import { Router } from "express";
import { CreatePayoutRequestSchema } from "@lifeline/contracts";
import { validateBody } from "../middleware/validate";
import { notImplemented } from "./not-implemented";

// Owner: Member 2 (feature/financial-intelligence). Mounted at /api/payments.
export const payoutRouter = Router();

payoutRouter.post("/payouts", validateBody(CreatePayoutRequestSchema), notImplemented("Payout"));
payoutRouter.post("/webhooks/paypal", notImplemented("PayPal webhook"));
