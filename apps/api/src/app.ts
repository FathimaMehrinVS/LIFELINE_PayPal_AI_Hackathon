import cors from "cors";
import express from "express";
import { env } from "./config/env";
import { errorHandler, notFoundHandler } from "./middleware/error-handler";
import { allocationRouter } from "./routes/allocation.routes";
import { casesRouter } from "./routes/cases.routes";
import { commerceRouter } from "./routes/commerce.routes";
import { donationRouter } from "./routes/donation.routes";
import { financeRouter } from "./routes/finance.routes";
import { payoutRouter } from "./routes/payout.routes";
import { mountPaypalWebhookRoute } from "./routes/paypal-webhook.routes";
import { situationRouter } from "./routes/situation.routes";

export function createApp() {
  const app = express();

  app.use(cors({ origin: env.WEB_ORIGIN }));
  mountPaypalWebhookRoute(app);
  app.use(express.json({ limit: "1mb" }));

  app.get("/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  app.use("/api/situation", situationRouter);
  app.use("/api/finance", financeRouter);
  app.use("/api/commerce", commerceRouter);
  app.use("/api/cases", casesRouter);
  app.use("/api/allocations", allocationRouter);
  // Both mounted at /api/payments; each router owns different paths.
  app.use("/api/payments", donationRouter);
  app.use("/api/payments", payoutRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
