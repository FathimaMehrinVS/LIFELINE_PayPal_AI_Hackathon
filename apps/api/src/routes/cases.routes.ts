import { randomUUID } from "node:crypto";
import { Router } from "express";
import { SituationRequestSchema } from "@lifeline/contracts";
import { validateBody } from "../middleware/validate";
import { caseStore } from "../orchestration/case-store";
import { caseModules } from "../orchestration/modules";
import { runCase } from "../orchestration/run-case";
import { sampleCases } from "../orchestration/sample-cases";

// Owner: Member 1 (feature/situation-agent). Runs the Orchestrator in src/orchestration/.
export const casesRouter = Router();

casesRouter.post("/", validateBody(SituationRequestSchema), async (req, res) => {
  const result = await runCase(`case_${randomUUID()}`, req.body, caseModules);
  await caseStore.save(result, req.body);
  res.status(201).json(result);
});

casesRouter.get("/", async (_req, res) => {
  res.json(await caseStore.list());
});

/** Sample cases for previewing the dashboard; never mixed into the real list. */
casesRouter.get("/samples", (_req, res) => {
  res.json(sampleCases());
});
