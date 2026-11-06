import { Router } from "express";
import { FinanceRequestSchema } from "@lifeline/contracts";
import { validateBody } from "../middleware/validate";
import { notImplemented } from "./not-implemented";

// Owner: Member 2 (feature/financial-intelligence)
export const financeRouter = Router();

financeRouter.post("/evaluate", validateBody(FinanceRequestSchema), notImplemented("Financial evaluation"));
