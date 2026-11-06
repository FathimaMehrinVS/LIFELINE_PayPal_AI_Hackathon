import { Router } from "express";
import { CommerceRequestSchema } from "@lifeline/contracts";
import { validateBody } from "../middleware/validate";
import { notImplemented } from "./not-implemented";

// Owner: Member 3 (feature/commerce-payments)
export const commerceRouter = Router();

commerceRouter.post("/basket", validateBody(CommerceRequestSchema), notImplemented("Basket building"));
