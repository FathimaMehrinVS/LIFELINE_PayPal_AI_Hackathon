import { env } from "../config/env";
import { getPrisma } from "../database/prisma";
import { HttpError } from "../utils/http-error";

export const AUTH_ROLES = ["NGO", "DONOR", "PARTNER"] as const;
export type AuthRole = (typeof AUTH_ROLES)[number];

export interface AuthSession {
  id: string;
  email: string;
  role: AuthRole;
}

interface SupabaseIdentity {
  id: string;
}

interface UserProfile {
  id: string;
  email: string | null;
  role: string | null;
}

export interface SessionResolverDependencies {
  getSupabaseIdentity: (accessToken: string) => Promise<SupabaseIdentity>;
  findProfile: (authUserId: string) => Promise<UserProfile | null>;
}

function getBearerToken(authorization: string | undefined): string {
  const match = authorization?.match(/^Bearer\s+(\S+)$/i);
  if (!match) throw new HttpError("AUTHENTICATION_REQUIRED", "A valid Bearer access token is required");
  return match[1]!;
}

async function getSupabaseIdentity(accessToken: string): Promise<SupabaseIdentity> {
  if (!env.SUPABASE_URL || !env.SUPABASE_ANON_KEY) {
    throw new HttpError("INTERNAL_ERROR", "Supabase Auth is not configured on the API server");
  }

  let response: Response;
  try {
    response = await fetch(`${env.SUPABASE_URL.replace(/\/$/, "")}/auth/v1/user`, {
      headers: {
        apikey: env.SUPABASE_ANON_KEY,
        Authorization: `Bearer ${accessToken}`,
      },
    });
  } catch {
    throw new HttpError("UPSTREAM_ERROR", "Could not reach Supabase Auth");
  }

  if (response.status === 401 || response.status === 403) {
    throw new HttpError("AUTHENTICATION_REQUIRED", "Supabase access token is invalid or expired");
  }
  if (!response.ok) {
    throw new HttpError("UPSTREAM_ERROR", `Supabase Auth returned HTTP ${response.status}`);
  }

  let body: unknown;
  try {
    body = await response.json();
  } catch {
    throw new HttpError("AUTHENTICATION_REQUIRED", "Supabase returned an invalid identity response");
  }
  if (!body || typeof body !== "object" || !("id" in body) || typeof body.id !== "string" || !body.id) {
    throw new HttpError("AUTHENTICATION_REQUIRED", "Supabase returned an invalid identity response");
  }
  return { id: body.id };
}

const defaultDependencies: SessionResolverDependencies = {
  getSupabaseIdentity,
  async findProfile(authUserId) {
    return getPrisma().user.findUnique({
      where: { authUserId },
      select: { id: true, email: true, role: true },
    });
  },
};

/** Validates a Supabase access token server-side, then loads the app-owned profile and role. */
export function createSessionResolver(dependencies: SessionResolverDependencies) {
  return async (authorization: string | undefined): Promise<AuthSession> => {
    const token = getBearerToken(authorization);
    const identity = await dependencies.getSupabaseIdentity(token);
    const profile = await dependencies.findProfile(identity.id);
    if (!profile) throw new HttpError("FORBIDDEN", "No LIFELINE profile is linked to this account");

    if (!profile.email || !AUTH_ROLES.includes(profile.role as AuthRole)) {
      throw new HttpError("FORBIDDEN", "The LIFELINE profile has no valid application role");
    }
    return { id: profile.id, email: profile.email, role: profile.role as AuthRole };
  };
}

export const resolveAuthenticatedSession = createSessionResolver(defaultDependencies);
