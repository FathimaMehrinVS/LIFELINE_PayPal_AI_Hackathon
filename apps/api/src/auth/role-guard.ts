import type { NextFunction, Request, RequestHandler, Response } from "express";
import { resolveAuthenticatedSession, type AuthRole, type AuthSession } from "./session";
import { HttpError } from "../utils/http-error";

export type SessionResolver = (authorization: string | undefined) => Promise<AuthSession>;

export function createRoleGuard(resolveSession: SessionResolver = resolveAuthenticatedSession) {
  return (...allowedRoles: AuthRole[]): RequestHandler => async (req, res, next: NextFunction) => {
    try {
      const session = await resolveSession(req.get("authorization"));
      if (!allowedRoles.includes(session.role)) throw new HttpError("FORBIDDEN", "Your LIFELINE role cannot access this resource");
      res.locals.authSession = session;
      next();
    } catch (error) {
      next(error);
    }
  };
}

export function getRequestSession(res: Response): AuthSession {
  const session: unknown = res.locals.authSession;
  if (!session || typeof session !== "object" || !("id" in session) || typeof session.id !== "string") {
    throw new HttpError("AUTHENTICATION_REQUIRED", "A verified LIFELINE session is required");
  }
  return session as AuthSession;
}
