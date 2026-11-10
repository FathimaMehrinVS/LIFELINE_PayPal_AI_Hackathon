import cors from "cors";
import express from "express";
import { env } from "./config/env";
import { createRoleGuard, type SessionResolver } from "./auth/role-guard";
import { errorHandler, notFoundHandler } from "./middleware/error-handler";
import { allocationRouter } from "./routes/allocation.routes";
import { authRouter } from "./routes/auth.routes";
import { casesRouter } from "./routes/cases.routes";
import { commerceRouter } from "./routes/commerce.routes";
import { donationRouter } from "./routes/donation.routes";
import { deliveriesRouter } from "./routes/deliveries.routes";
import { financeRouter } from "./routes/finance.routes";
import { payoutRouter } from "./routes/payout.routes";
import { mountPaypalWebhookRoute } from "./routes/paypal-webhook.routes";
import { plansRouter } from "./routes/plans.routes";
import { purchaseOrdersRouter } from "./routes/purchase-orders.routes";
import { recordsRouter } from "./routes/records.routes";
import { situationRouter } from "./routes/situation.routes";
import { suppliersRouter } from "./routes/suppliers.routes";

export function createApp(dependencies: { resolveSession?: SessionResolver } = {}) {
  const app = express();
  const requireRoles = createRoleGuard(dependencies.resolveSession);

  app.use(cors({ origin: env.WEB_ORIGIN }));
  mountPaypalWebhookRoute(app);
  app.use(express.json({ limit: "1mb" }));

  app.get("/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  app.use("/api/auth", authRouter);
  app.use("/api/situation", requireRoles("NGO", "DONOR", "PARTNER"), situationRouter);
  app.use("/api/finance", requireRoles("NGO", "DONOR", "PARTNER"), financeRouter);
  app.use("/api/commerce", requireRoles("NGO", "DONOR", "PARTNER"), commerceRouter);
  app.use("/api/cases", requireRoles("NGO", "DONOR", "PARTNER"), casesRouter);
  app.use("/api/suppliers", requireRoles("NGO"), suppliersRouter);
  app.use("/api/allocations", requireRoles("NGO"), allocationRouter);
  app.use("/api/deliveries", requireRoles("NGO", "PARTNER"), deliveriesRouter);
  app.use("/api/purchase-orders", requireRoles("NGO", "PARTNER"), purchaseOrdersRouter);
  app.use("/api/plans", requireRoles("DONOR", "NGO"), plansRouter);
  app.use("/api/records", requireRoles("NGO"), recordsRouter);
  // Both mounted at /api/payments; each router owns different paths.
  app.use("/api/payments", requireRoles("DONOR", "NGO"), donationRouter);
  app.use("/api/payments", requireRoles("NGO"), payoutRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
