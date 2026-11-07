import { randomUUID } from "node:crypto";
import { Router } from "express";
import { SituationRequestSchema } from "@lifeline/contracts";
import { validateBody } from "../middleware/validate";
import { caseStore } from "../orchestration/case-store";
import { caseModules } from "../orchestration/modules";
import { runCase } from "../orchestration/run-case";
import { sampleCases } from "../orchestration/sample-cases";
import { HttpError } from "../utils/http-error";

// Owner: Member 1 (feature/situation-agent). Runs the Orchestrator in src/orchestration/.
export const casesRouter = Router();

const CASE_ID = /^case_[0-9a-f-]{36}$/;

/**
 * Runs a case. With `?replaces=<case_id>`, re-runs a case that stopped for missing information (the person added
 * answers), keeping its id so the dashboard shows one case per family instead of a copy per attempt.
 */
casesRouter.post("/", validateBody(SituationRequestSchema), async (req, res) => {
  const replaces = typeof req.query.replaces === "string" ? req.query.replaces : null;
  let caseId = `case_${randomUUID()}`;
  if (replaces) {
    const existing = CASE_ID.test(replaces) ? (await caseStore.list()).find((c) => c.case_id === replaces) : undefined;
    if (!existing) throw new HttpError("NOT_FOUND", "The case to update was not found");
    // A complete case may already be approved; changes to it start a new case instead.
    if (existing.status === "complete") throw new HttpError("VALIDATION_ERROR", "This case is complete and can't be changed");
    caseId = replaces;
  }
  const result = await runCase(caseId, req.body, caseModules);
  await caseStore.save(result, req.body);
  res.status(replaces ? 200 : 201).json(result);
});

casesRouter.get("/", async (_req, res) => {
  res.json(await caseStore.list());
});

/** Sample cases for previewing the dashboard; never mixed into the real list. */
casesRouter.get("/samples", (_req, res) => {
  res.json(sampleCases());
});
