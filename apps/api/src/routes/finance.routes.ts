import { Router } from "express";
import { FinanceRequestSchema, type FinanceRequest } from "@lifeline/contracts";
import { llm } from "../ai/llm-client";
import { validateBody } from "../middleware/validate";
import { evaluateRoutes } from "../modules/finance/finance.service";

// Owner: Member 2 (feature/financial-intelligence)
export const financeRouter = Router();

financeRouter.post("/evaluate", validateBody(FinanceRequestSchema), async (req, res) => {
  res.json(await evaluateRoutes(req.body as FinanceRequest, llm));
});
