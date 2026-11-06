import type { ErrorRequestHandler, RequestHandler } from "express";
import type { ApiError } from "@lifeline/contracts";
import { HttpError } from "../utils/http-error";

export const notFoundHandler: RequestHandler = (req) => {
  throw new HttpError("NOT_FOUND", `No route for ${req.method} ${req.path}`);
};

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof HttpError) {
    const body: ApiError = { error: { code: err.code, message: err.message, details: err.details } };
    res.status(err.status).json(body);
    return;
  }

  console.error(err);
  const body: ApiError = { error: { code: "INTERNAL_ERROR", message: "Unexpected server error" } };
  res.status(500).json(body);
};
