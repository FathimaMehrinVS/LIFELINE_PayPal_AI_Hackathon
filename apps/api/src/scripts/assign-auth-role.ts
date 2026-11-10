import { env } from "../config/env";
import { getPrisma } from "../database/prisma";
import { AUTH_ROLES, type AuthRole } from "../auth/session";

const [authUserId, requestedRole, ...extraArgs] = process.argv.slice(2);
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}

if (!authUserId || !uuidPattern.test(authUserId) || !requestedRole || extraArgs.length || !AUTH_ROLES.includes(requestedRole as AuthRole)) {
  fail("Usage: npm run auth:assign-role -- <supabase-auth-user-uuid> <ADMIN|NGO|DONOR|PARTNER>");
}
if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
  fail("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required for this admin command");
}

interface AdminAuthUser {
  id?: unknown;
  email?: unknown;
  user_metadata?: unknown;
}

function displayName(user: AdminAuthUser, email: string): string {
  if (user.user_metadata && typeof user.user_metadata === "object") {
    const metadata = user.user_metadata as Record<string, unknown>;
    if (typeof metadata.full_name === "string" && metadata.full_name.trim()) return metadata.full_name.trim();
    if (typeof metadata.name === "string" && metadata.name.trim()) return metadata.name.trim();
  }
  return email;
}

async function main() {
  const response = await fetch(`${env.SUPABASE_URL!.replace(/\/$/, "")}/auth/v1/admin/users/${encodeURIComponent(authUserId!)}`, {
    headers: {
      apikey: env.SUPABASE_SERVICE_ROLE_KEY!,
      Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY!}`,
    },
  });
  if (!response.ok) fail(`Supabase Admin API returned HTTP ${response.status}`);

  const raw: unknown = await response.json();
  const user = raw && typeof raw === "object" && "user" in raw && raw.user && typeof raw.user === "object"
    ? raw.user as AdminAuthUser
    : raw as AdminAuthUser;
  if (user.id !== authUserId || typeof user.email !== "string" || !user.email.trim()) {
    fail("Supabase Admin API did not return the requested user with an email");
  }

  const prisma = getPrisma();
  try {
    const existing = await prisma.user.findUnique({ where: { authUserId } });
    if (existing) {
      await prisma.user.update({
        where: { authUserId },
        data: { email: user.email, role: requestedRole as AuthRole },
      });
    } else {
      await prisma.user.create({
        data: { authUserId, email: user.email, role: requestedRole as AuthRole, name: displayName(user, user.email) },
      });
    }
  } finally {
    await prisma.$disconnect();
  }
  console.log(`Assigned ${requestedRole} role to Supabase user ${authUserId}.`);
}

void main().catch(() => fail("Could not assign the application role; check the database and Supabase Admin configuration."));
