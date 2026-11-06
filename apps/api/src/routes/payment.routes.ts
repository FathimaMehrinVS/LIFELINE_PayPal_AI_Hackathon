import { Router } from "express";
import { CreatePaymentRequestSchema } from "@lifeline/contracts";
import { validateBody } from "../middleware/validate";
import { notImplemented } from "./not-implemented";

// Owner: Member 3 (feature/commerce-payments)
export const paymentRouter = Router();

paymentRouter.post("/", validateBody(CreatePaymentRequestSchema), notImplemented("Payment creation"));
paymentRouter.post("/:id/capture", notImplemented("Payment capture"));
