import { Router } from "express";
import { CreateDonationRequestSchema } from "@lifeline/contracts";
import { validateBody } from "../middleware/validate";
import { notImplemented } from "./not-implemented";

// Owner: Member 3 (feature/commerce-payments). Mounted at /api/payments.
export const donationRouter = Router();

donationRouter.post("/donations", validateBody(CreateDonationRequestSchema), notImplemented("Donation order"));
donationRouter.post("/donations/:id/capture", notImplemented("Donation capture"));
