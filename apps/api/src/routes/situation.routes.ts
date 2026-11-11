import { Router } from "express";
import { SituationRequestSchema } from "@lifeline/contracts";
import { llm } from "../ai/llm-client";
import { validateBody } from "../middleware/validate";
import { analyzeSituationCached } from "../modules/situation/analysis-cache";

// Owner: Member 1 (feature/situation-agent)
export const situationRouter = Router();

situationRouter.post("/analyze", validateBody(SituationRequestSchema), async (req, res) => {
  res.json(await analyzeSituationCached(req.body, llm));
});
