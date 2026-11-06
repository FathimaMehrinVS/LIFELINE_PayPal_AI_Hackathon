import cors from "cors";
import express from "express";
import { env } from "./config/env";
import { errorHandler, notFoundHandler } from "./middleware/error-handler";
import { commerceRouter } from "./routes/commerce.routes";
import { financeRouter } from "./routes/finance.routes";
import { paymentRouter } from "./routes/payment.routes";
import { situationRouter } from "./routes/situation.routes";

export function createApp() {
  const app = express();

  app.use(cors({ origin: env.WEB_ORIGIN }));
  app.use(express.json({ limit: "1mb" }));

  app.get("/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  app.use("/api/situation", situationRouter);
  app.use("/api/finance", financeRouter);
  app.use("/api/commerce", commerceRouter);
  app.use("/api/payments", paymentRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
