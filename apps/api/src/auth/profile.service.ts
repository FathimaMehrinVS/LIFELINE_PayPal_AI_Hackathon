import type { SupabaseIdentity } from "./session";
import { getPrisma } from "../database/prisma";
import { HttpError } from "../utils/http-error";

export interface ProvisionedProfile {
  id: string;
  email: string;
  role: string | null;
}

export interface ProfileProvisionDependencies {
  findByAuthUserId: (authUserId: string) => Promise<ProvisionedProfile | null>;
  create: (input: { authUserId: string; email: string; name: string; role: typeof NEW_ACCOUNT_ROLE }) => Promise<ProvisionedProfile>;
}

/** New accounts can give and follow plans straight away. Partner and NGO access is granted by NGO staff. */
export const NEW_ACCOUNT_ROLE = "DONOR" as const;

function isUniqueConstraintError(error: unknown): boolean {
  return Boolean(error && typeof error === "object" && "code" in error && error.code === "P2002");
}

export function createPendingProfileProvisioner(dependencies: ProfileProvisionDependencies) {
  return async (identity: SupabaseIdentity): Promise<ProvisionedProfile> => {
    const email = identity.email?.trim();
    if (!email) throw new HttpError("FORBIDDEN", "A Supabase account email is required to set up a LIFELINE profile");

    const existing = await dependencies.findByAuthUserId(identity.id);
    if (existing) return existing;

    try {
      return await dependencies.create({
        authUserId: identity.id,
        email,
        name: identity.name?.trim() || email,
        role: NEW_ACCOUNT_ROLE,
      });
    } catch (error) {
      if (!isUniqueConstraintError(error)) throw error;
      // Concurrent calls for the same Supabase identity converge on its unique linked profile.
      const createdByConcurrentRequest = await dependencies.findByAuthUserId(identity.id);
      if (createdByConcurrentRequest) return createdByConcurrentRequest;
      throw new HttpError("CONFLICT", "This email is already associated with another LIFELINE profile");
    }
  };
}

const defaultDependencies: ProfileProvisionDependencies = {
  async findByAuthUserId(authUserId) {
    return getPrisma().user.findUnique({ where: { authUserId }, select: { id: true, email: true, role: true } });
  },
  async create(input) {
    return getPrisma().user.create({ data: input, select: { id: true, email: true, role: true } });
  },
};

export const provisionPendingProfile = createPendingProfileProvisioner(defaultDependencies);
