import { CreateSupplierRequestSchema, UpdateSupplierStatusRequestSchema } from "@lifeline/contracts";
import { Router } from "express";
import { getRequestSession } from "../auth/role-guard";
import { getPrisma } from "../database/prisma";
import { validateBody } from "../middleware/validate";
import { getSupplier, listSuppliers, registerSupplier, updateSupplierStatus } from "../modules/suppliers/supplier.service";

// Owner: Member 1. NGO only (see app.ts).
export function createSupplierRouter(getDatabase: typeof getPrisma = getPrisma) {
  const router = Router();

  router.get("/", async (_req, res) => {
    res.json(await listSuppliers(getDatabase()));
  });

  router.get("/:id", async (req, res) => {
    res.json(await getSupplier(getDatabase(), String(req.params.id)));
  });

  router.post("/", validateBody(CreateSupplierRequestSchema), async (req, res) => {
    res.status(201).json(await registerSupplier(getDatabase(), req.body, getRequestSession(res).id));
  });

  router.post("/:id/status", validateBody(UpdateSupplierStatusRequestSchema), async (req, res) => {
    res.json(await updateSupplierStatus(getDatabase(), String(req.params.id), req.body, getRequestSession(res).id));
  });

  return router;
}

export const suppliersRouter = createSupplierRouter();
