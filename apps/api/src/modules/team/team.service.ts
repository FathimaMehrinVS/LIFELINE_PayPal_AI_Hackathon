import type { TeamMember, TeamRole } from "@lifeline/contracts";
import type { getPrisma } from "../../database/prisma";
import { HttpError } from "../../utils/http-error";

// Owner: Member 1. Replaces the terminal command for giving people access. Every change is audited.

type Database = ReturnType<typeof getPrisma>;
export const ROLE_CHANGED = "user.role_changed";

const toMember = (user: { id: string; email: string; name: string; role: string | null; createdAt: Date }): TeamMember => ({
  id: user.id, email: user.email, name: user.name, role: user.role as TeamRole | null, created_at: user.createdAt.toISOString(),
});

/** Accounts without a role first, then newest. */
export async function listTeam(db: Database): Promise<TeamMember[]> {
  const users = await db.user.findMany({ select: { id: true, email: true, name: true, role: true, createdAt: true }, orderBy: { createdAt: "desc" } });
  return users.map(toMember).sort((a, b) => Number(a.role !== null) - Number(b.role !== null));
}

export async function changeRole(db: Database, userId: string, role: TeamRole, actorId: string): Promise<TeamMember> {
  if (userId === actorId) throw new HttpError("VALIDATION_ERROR", "You can't change your own access. Ask another NGO team member.");
  const updated = await db.$transaction(async (tx) => {
    const user = await tx.user.findUnique({ where: { id: userId }, select: { role: true } });
    if (!user) throw new HttpError("NOT_FOUND", "Account not found");
    if (user.role === role) throw new HttpError("VALIDATION_ERROR", `This account already has ${role} access`);
    const changed = await tx.user.update({ where: { id: userId }, data: { role }, select: { id: true, email: true, name: true, role: true, createdAt: true } });
    await tx.auditLog.create({ data: { action: ROLE_CHANGED, entityType: "User", entityId: userId, actorId, details: { from: user.role?.toLowerCase() ?? "pending", to: role.toLowerCase() } } });
    return changed;
  });
  return toMember(updated);
}
