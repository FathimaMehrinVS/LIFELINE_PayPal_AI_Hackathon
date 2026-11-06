import { Router } from "express";
import { SituationRequestSchema } from "@lifeline/contracts";
import { validateBody } from "../middleware/validate";
import { notImplemented } from "./not-implemented";

// Owner: Member 1 (feature/situation-agent)
export const situationRouter = Router();

situationRouter.post("/analyze", validateBody(SituationRequestSchema), notImplemented("Situation analysis"));
