import { Router } from "express";
import { SubmitDeliveryEventRequestSchema, VerifyDeliveryRequestSchema } from "@lifeline/contracts";
import { getRequestSession } from "../auth/role-guard";
import { getPrisma } from "../database/prisma";
import { getPurchaseOrderAllocationId, listPurchaseOrders } from "../modules/procurement/purchase-orders.service";
import { submitDeliveryEvent, verifyDelivery } from "../modules/delivery/delivery.service";
import { validateBody } from "../middleware/validate";
import { HttpError } from "../utils/http-error";

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

  router.post("/:purchaseOrderId/handover", validateBody(VerifyDeliveryRequestSchema), async (req, res) => {
    const session = getRequestSession(res);
    if (session.role !== "NGO") throw new HttpError("FORBIDDEN", "Only an NGO worker can confirm collection");
    const allocationId = await getPurchaseOrderAllocationId(getDatabase(), String(req.params.purchaseOrderId), session);
    const result = await verifyDelivery(allocationId, req.body, session, getDatabase);
    res.json(result.record);
  });

  return router;
}

export const purchaseOrdersRouter = createPurchaseOrdersRouter();
