import { Router } from "express";
import { getRequestSession } from "../auth/role-guard";
import { getPrisma } from "../database/prisma";
import { listPurchaseOrders } from "../modules/procurement/purchase-orders.service";

export function createPurchaseOrdersRouter(getDatabase: typeof getPrisma = getPrisma) {
  const router = Router();

  router.get("/", async (_req, res) => {
    res.json(await listPurchaseOrders(getDatabase(), getRequestSession(res)));
  });

  return router;
}

export const purchaseOrdersRouter = createPurchaseOrdersRouter();
