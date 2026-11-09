import { AssignDeliveryRequestSchema, SubmitDeliveryEventRequestSchema, VerifyDeliveryRequestSchema } from "@lifeline/contracts";
import { Router } from "express";
import { getRequestSession } from "../auth/role-guard";
import { getPrisma } from "../database/prisma";
import { assignDelivery, getDeliveryRecord, listAssignedDeliveries, listDeliveryAllocations, listDeliveryPartners, submitDeliveryEvent, verifyDelivery } from "../modules/delivery/delivery.service";
import { validateBody } from "../middleware/validate";
import { HttpError } from "../utils/http-error";

export function createDeliveryRouter(getDatabase: typeof getPrisma = getPrisma) {
  const router = Router();

  router.get("/partners", async (_req, res) => {
    if (getRequestSession(res).role !== "NGO") throw new HttpError("FORBIDDEN", "Only NGO users can assign delivery partners");
    res.json(await listDeliveryPartners(getDatabase()));
  });

  router.get("/", async (_req, res) => {
    const session = getRequestSession(res);
    res.json(session.role === "NGO" ? await listDeliveryAllocations(getDatabase()) : await listAssignedDeliveries(getDatabase(), session.id));
  });

  router.post("/", validateBody(AssignDeliveryRequestSchema), async (req, res) => {
    const session = getRequestSession(res);
    if (session.role !== "NGO") throw new HttpError("FORBIDDEN", "Only NGO users can assign delivery partners");
    const result = await assignDelivery(req.body, session, getDatabase);
    res.status(result.duplicate ? 200 : 201).json(result.record);
  });

  router.get("/:allocationId", async (req, res) => {
    res.json(await getDeliveryRecord(getDatabase(), String(req.params.allocationId), getRequestSession(res)));
  });

  router.post("/:allocationId/events", validateBody(SubmitDeliveryEventRequestSchema), async (req, res) => {
    const session = getRequestSession(res);
    if (session.role !== "PARTNER") throw new HttpError("FORBIDDEN", "Only an assigned PARTNER can submit delivery updates");
    res.json(await submitDeliveryEvent(String(req.params.allocationId), req.body, session, getDatabase));
  });

  router.post("/:allocationId/verify", validateBody(VerifyDeliveryRequestSchema), async (req, res) => {
    const session = getRequestSession(res);
    if (session.role !== "NGO") throw new HttpError("FORBIDDEN", "Only NGO users can verify delivery");
    const result = await verifyDelivery(String(req.params.allocationId), req.body, session, getDatabase);
    res.json(result.record);
  });

  return router;
}

export const deliveriesRouter = createDeliveryRouter();
