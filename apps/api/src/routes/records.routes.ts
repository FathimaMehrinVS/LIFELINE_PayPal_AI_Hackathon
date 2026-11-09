import { Router } from "express";
import { getPrisma } from "../database/prisma";
import { getAuditRecords, getLedger } from "../modules/records/records.service";

// Owner: Member 1. Mounted at /api/records, NGO only.
export function createRecordsRouter(db: typeof getPrisma = getPrisma) {
  const router = Router();

  router.get("/ledger", async (_req, res) => {
    res.json(await getLedger(db()));
  });

  router.get("/audit", async (_req, res) => {
    res.json(await getAuditRecords(db()));
  });

  return router;
}

export const recordsRouter = createRecordsRouter();
