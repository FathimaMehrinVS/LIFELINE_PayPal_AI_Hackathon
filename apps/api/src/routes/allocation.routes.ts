import { Router } from "express";
import { ApproveAllocationRequestSchema } from "@lifeline/contracts";
import { approveAllocation } from "../modules/finance/allocation.service";
import { getPrisma } from "../database/prisma";
import { validateBody } from "../middleware/validate";
import { getRequestSession } from "../auth/role-guard";

// Owner: Member 2 (feature/financial-intelligence)
export function createAllocationRouter(getDatabase: typeof getPrisma = getPrisma) {
  const router = Router();

  router.post("/approve", validateBody(ApproveAllocationRequestSchema), async (req, res) => {
    const actor = getRequestSession(res);
    const result = await approveAllocation(req.body, actor.id, getDatabase);
    res.status(200).json(result);
  });

  return router;
}

export const allocationRouter = createAllocationRouter();
