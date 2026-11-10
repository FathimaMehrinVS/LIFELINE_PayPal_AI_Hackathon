import { UpdateTeamRoleRequestSchema } from "@lifeline/contracts";
import { Router } from "express";
import { getRequestSession } from "../auth/role-guard";
import { getPrisma } from "../database/prisma";
import { validateBody } from "../middleware/validate";
import { changeRole, listTeam } from "../modules/team/team.service";

// Owner: Member 1. Mounted at /api/team, NGO only.
export function createTeamRouter(db: typeof getPrisma = getPrisma) {
  const router = Router();

  router.get("/", async (_req, res) => {
    res.json(await listTeam(db()));
  });

  router.post("/:id/role", validateBody(UpdateTeamRoleRequestSchema), async (req, res) => {
    res.json(await changeRole(db(), String(req.params.id), req.body.role, getRequestSession(res).id));
  });

  return router;
}

export const teamRouter = createTeamRouter();
