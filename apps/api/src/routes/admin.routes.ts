import { AUTH_ROLES, type AuthRole } from "../auth/session";
import { Router } from "express";
import { z } from "zod";
import { getRequestSession } from "../auth/role-guard";
import { getPrisma } from "../database/prisma";
import { validateBody } from "../middleware/validate";
import { HttpError } from "../utils/http-error";

const UpdateRoleSchema = z.object({ role: z.enum(AUTH_ROLES) }).strict();

export function createAdminRouter(getDatabase: typeof getPrisma = getPrisma) {
  const router = Router();

  router.get("/users", async (_req, res) => {
    const users = await getDatabase().user.findMany({
      where: { authUserId: { not: null } },
      select: { id: true, name: true, email: true, role: true, createdAt: true },
      orderBy: [{ name: "asc" }, { email: "asc" }],
    });
    res.json(users.map((user) => ({
      id: user.id,
      name: user.name,
      email: user.email,
      role: AUTH_ROLES.includes(user.role as AuthRole) ? user.role : null,
      created_at: user.createdAt.toISOString(),
    })));
  });

  router.post("/users/:id/role", validateBody(UpdateRoleSchema), async (req, res) => {
    const db = getDatabase();
    const actor = getRequestSession(res);
    const id = String(req.params.id);
    const role = req.body.role as AuthRole;
    if (id === actor.id) throw new HttpError("VALIDATION_ERROR", "You can't change your own role");
    const target = await db.user.findUnique({ where: { id }, select: { id: true, authUserId: true, role: true } });
    if (!target || !target.authUserId) throw new HttpError("NOT_FOUND", "LIFELINE account not found");

    if (target.role === "ADMIN" && role !== "ADMIN") {
      const adminCount = await db.user.count({ where: { role: "ADMIN", authUserId: { not: null } } });
      if (adminCount <= 1) throw new HttpError("CONFLICT", "LIFELINE must keep at least one Admin account");
    }

    const updated = await db.user.update({ where: { id }, data: { role }, select: { id: true, name: true, email: true, role: true, createdAt: true } });
    await db.auditLog.create({
      data: {
        actorId: actor.id,
        action: "user.role_updated",
        entityType: "User",
        entityId: id,
        details: { previous_role: target.role, assigned_role: role },
      },
    });
    res.json({ ...updated, created_at: updated.createdAt.toISOString() });
  });

  return router;
}

export const adminRouter = createAdminRouter();
