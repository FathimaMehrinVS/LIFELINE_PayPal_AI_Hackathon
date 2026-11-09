import { Router } from "express";
import { getRequestSession } from "../auth/role-guard";
import { getPrisma } from "../database/prisma";
import { getPlan, listContributions, listPlans } from "../modules/plans/plan.service";

// Owner: Member 1. Mounted at /api/plans. Everything here is safe for donors to see.
export function createPlansRouter(db: typeof getPrisma = getPrisma) {
  const router = Router();

  router.get("/", async (_req, res) => {
    res.json(await listPlans(db()));
  });

  router.get("/contributions", async (_req, res) => {
    res.json(await listContributions(db(), getRequestSession(res).id));
  });

  router.get("/:id", async (req, res) => {
    res.json(await getPlan(db(), String(req.params.id)));
  });

  return router;
}

export const plansRouter = createPlansRouter();
