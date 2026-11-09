import { Router } from "express";
import { CreatePayoutRequestSchema } from "@lifeline/contracts";
import { simulateAllocationDisbursement } from "../modules/finance/disbursement.service";
import { getPrisma } from "../database/prisma";
import { validateBody } from "../middleware/validate";
import { getRequestSession } from "../auth/role-guard";

// Owner: Member 2 (feature/financial-intelligence). This endpoint records a simulated aid-side disbursement.
export function createPayoutRouter(getDatabase: typeof getPrisma = getPrisma) {
  const router = Router();

  router.post("/payouts", validateBody(CreatePayoutRequestSchema), async (req, res) => {
    const actor = getRequestSession(res);
    const { result, duplicate } = await simulateAllocationDisbursement(req.body, actor.id, getDatabase);
    res.status(duplicate ? 200 : 201).json(result);
  });

  return router;
}

export const payoutRouter = createPayoutRouter();
