import { Router } from "express";
import type { AuthSession } from "../auth/session";
import { resolveAuthenticatedSession } from "../auth/session";

type SessionResolver = (authorization: string | undefined) => Promise<AuthSession>;

export function createAuthRouter(resolveSession: SessionResolver = resolveAuthenticatedSession) {
  const router = Router();
  router.get("/me", async (req, res) => {
    const session = await resolveSession(req.get("authorization"));
    res.json(session);
  });
  return router;
}

export const authRouter = createAuthRouter();
