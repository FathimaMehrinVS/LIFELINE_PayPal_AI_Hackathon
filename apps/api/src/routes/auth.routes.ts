import { Router } from "express";
import type { AuthSession } from "../auth/session";
import { resolveAuthenticatedSession, resolveSupabaseIdentity } from "../auth/session";
import { provisionPendingProfile } from "../auth/profile.service";
import type { SupabaseIdentity } from "../auth/session";
import type { ProvisionedProfile } from "../auth/profile.service";

type SessionResolver = (authorization: string | undefined) => Promise<AuthSession>;
type IdentityResolver = (authorization: string | undefined) => Promise<SupabaseIdentity>;
type ProfileProvisioner = (identity: SupabaseIdentity) => Promise<ProvisionedProfile>;

export function createAuthRouter(
  resolveSession: SessionResolver = resolveAuthenticatedSession,
  resolveIdentity: IdentityResolver = resolveSupabaseIdentity,
  provisionProfile: ProfileProvisioner = provisionPendingProfile,
) {
  const router = Router();
  router.get("/me", async (req, res) => {
    const session = await resolveSession(req.get("authorization"));
    res.json(session);
  });
  router.post("/profile", async (req, res) => {
    const identity = await resolveIdentity(req.get("authorization"));
    // Deliberately ignore request-body role/email fields: identity comes only from verified Supabase Auth.
    const profile = await provisionProfile(identity);
    res.json(profile);
  });
  return router;
}

export const authRouter = createAuthRouter();
