import { Router } from "express";
import { SubmitDeliveryEventRequestSchema } from "@lifeline/contracts";
import { getRequestSession } from "../auth/role-guard";
import { getPrisma } from "../database/prisma";
import { getPurchaseOrderAllocationId, listPurchaseOrders } from "../modules/procurement/purchase-orders.service";
import { submitDeliveryEvent } from "../modules/delivery/delivery.service";
import { validateBody } from "../middleware/validate";

export function createPurchaseOrdersRouter(getDatabase: typeof getPrisma = getPrisma) {
  const router = Router();

  router.get("/", async (_req, res) => {
    res.json(await listPurchaseOrders(getDatabase(), getRequestSession(res)));
  });

  router.post("/:purchaseOrderId/events", validateBody(SubmitDeliveryEventRequestSchema), async (req, res) => {
    const session = getRequestSession(res);
    const allocationId = await getPurchaseOrderAllocationId(getDatabase(), String(req.params.purchaseOrderId), session);
    res.json(await submitDeliveryEvent(allocationId, req.body, session, getDatabase));
  });

  return router;
}

export const purchaseOrdersRouter = createPurchaseOrdersRouter();
