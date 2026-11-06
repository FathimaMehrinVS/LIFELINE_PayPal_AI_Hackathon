import type { RequestHandler } from "express";
import type { ZodType } from "zod";
import { HttpError } from "../utils/http-error";

/** Validates req.body against a contract schema and replaces it with the parsed value. */
export function validateBody(schema: ZodType): RequestHandler {
  return (req, _res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      throw new HttpError(
        "VALIDATION_ERROR",
        "Request body does not match the contract",
        result.error.issues.map((issue) => ({ path: issue.path.join("."), message: issue.message })),
      );
    }
    req.body = result.data;
    next();
  };
}
