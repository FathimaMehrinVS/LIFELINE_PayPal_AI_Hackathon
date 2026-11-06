import type { RequestHandler } from "express";
import { HttpError } from "../utils/http-error";

/** Placeholder handler until the owning feature branch implements the route. */
export function notImplemented(feature: string): RequestHandler {
  return () => {
    throw new HttpError("NOT_IMPLEMENTED", `${feature} is not implemented yet`);
  };
}
