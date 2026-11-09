import { randomUUID } from "node:crypto";
import { Router } from "express";
import { SituationRequestSchema } from "@lifeline/contracts";
import { validateBody } from "../middleware/validate";
import { env } from "../config/env";
import { getPrisma } from "../database/prisma";
import { attachOperations, getCaseTimeline } from "../orchestration/case-operations";
import { caseStore } from "../orchestration/case-store";
import { caseModules } from "../orchestration/modules";
import { runCase } from "../orchestration/run-case";
import { sampleCases } from "../orchestration/sample-cases";
import { HttpError } from "../utils/http-error";
import { getRequestSession } from "../auth/role-guard";

// Owner: Member 1 (feature/situation-agent). Runs the Orchestrator in src/orchestration/.
export const casesRouter = Router();

const CASE_ID = /^case_[0-9a-f-]{36}$/;

/**
 * Runs a case. With `?replaces=<case_id>`, re-runs a case that stopped for missing information (the person added
 * answers), keeping its id so the dashboard shows one case per family instead of a copy per attempt.
 */
casesRouter.post("/", validateBody(SituationRequestSchema), async (req, res) => {
  const session = getRequestSession(res);
  const replaces = typeof req.query.replaces === "string" ? req.query.replaces : null;
  let caseId = `case_${randomUUID()}`;
  if (replaces) {
    const ownerId = CASE_ID.test(replaces) ? await caseStore.ownerOf(replaces) : null;
    // NGO reviewers may inspect every case, but a re-run is still an owner action.
    // Unowned legacy/demo cases remain available to NGO staff for continuity.
    if (ownerId && ownerId !== session.id) throw new HttpError("NOT_FOUND", "The case to update was not found");
    const candidates = session.role === "NGO" ? await caseStore.list() : await caseStore.listByOwner(session.id);
    const existing = CASE_ID.test(replaces) ? candidates.find((c) => c.case_id === replaces) : undefined;
    if (!existing) throw new HttpError("NOT_FOUND", "The case to update was not found");
    // A complete case may already be approved; changes to it start a new case instead.
    if (existing.status === "complete") throw new HttpError("VALIDATION_ERROR", "This case is complete and can't be changed");
    caseId = replaces;
  }
  const result = await runCase(caseId, req.body, caseModules);
  await caseStore.save(result, req.body, replaces ? undefined : session.id);
  res.status(replaces ? 200 : 201).json(result);
});

casesRouter.get("/mine", async (_req, res) => {
  const session = getRequestSession(res);
  res.json(await caseStore.listByOwner(session.id));
});

casesRouter.get("/", async (_req, res) => {
  if (getRequestSession(res).role !== "NGO") throw new HttpError("FORBIDDEN", "Only NGO users can view all assistance cases");
  const cases = await caseStore.list();
  res.json(env.DATABASE_URL ? await attachOperations(getPrisma(), cases) : cases);
});

casesRouter.get("/:id/timeline", async (req, res) => {
  if (getRequestSession(res).role !== "NGO") throw new HttpError("FORBIDDEN", "Only NGO users can view a case timeline");
  res.json(await getCaseTimeline(getPrisma(), String(req.params.id)));
});

/** Sample cases for previewing the dashboard; never mixed into the real list. */
casesRouter.get("/samples", (_req, res) => {
  if (getRequestSession(res).role !== "NGO") throw new HttpError("FORBIDDEN", "Only NGO users can view sample cases");
  res.json(sampleCases());
});
