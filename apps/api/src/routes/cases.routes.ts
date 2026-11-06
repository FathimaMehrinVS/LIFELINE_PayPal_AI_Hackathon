import { Router } from "express";
import { SituationRequestSchema } from "@lifeline/contracts";
import { validateBody } from "../middleware/validate";
import { notImplemented } from "./not-implemented";

// Owner: Member 1 (feature/situation-agent). Runs the Orchestrator in src/orchestration/.
export const casesRouter = Router();

casesRouter.post("/", validateBody(SituationRequestSchema), notImplemented("Case orchestration"));
casesRouter.get("/", notImplemented("Case list"));
