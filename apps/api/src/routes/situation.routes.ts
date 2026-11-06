import { Router } from "express";
import { SituationRequestSchema } from "@lifeline/contracts";
import { llm } from "../ai/llm-client";
import { validateBody } from "../middleware/validate";
import { analyzeSituation } from "../modules/situation/situation.service";

// Owner: Member 1 (feature/situation-agent)
export const situationRouter = Router();

situationRouter.post("/analyze", validateBody(SituationRequestSchema), async (req, res) => {
  res.json(await analyzeSituation(req.body, llm));
});
