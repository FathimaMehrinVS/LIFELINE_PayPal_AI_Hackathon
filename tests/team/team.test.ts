import express from "express";
import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import { createApp } from "../../apps/api/src/app";
import { errorHandler } from "../../apps/api/src/middleware/error-handler";
import { createTeamRouter } from "../../apps/api/src/routes/team.routes";

function setup(role: string | null = "DONOR") {
  const state = { role };
  const audit: { action: string; actorId: string; details: unknown }[] = [];
  const user = {
    findMany: vi.fn(async () => [
      { id: "u_old", email: "old@example.test", name: "Old", role: null, createdAt: new Date("2026-11-01T00:00:00Z") },
      { id: "u_1", email: "person@example.test", name: "Person", role: state.role, createdAt: new Date("2026-11-09T00:00:00Z") },
    ]),
    findUnique: vi.fn(async () => ({ role: state.role })),
    update: vi.fn(async ({ data }: { data: { role: string } }) => { state.role = data.role; return { id: "u_1", email: "person@example.test", name: "Person", role: data.role, createdAt: new Date("2026-11-09T00:00:00Z") }; }),
  };
  const auditLog = { create: vi.fn(async ({ data }: { data: (typeof audit)[number] }) => { audit.push(data); return {}; }) };
  const db = { user, auditLog, $transaction: async (work: (tx: unknown) => Promise<unknown>) => work({ user, auditLog }) };
  const app = express();
  app.use(express.json());
  app.use((_req, res, next) => { res.locals.authSession = { id: "ngo_1", email: "ngo@example.test", role: "NGO" }; next(); });
  app.use("/", createTeamRouter((() => db) as never));
  app.use(errorHandler);
  return { app, audit, state };
}

describe("team and access", () => {
  it("lists accounts without access first", async () => {
    const res = await request(setup().app).get("/");
    expect(res.status).toBe(200);
    expect(res.body.map((member: { id: string }) => member.id)).toEqual(["u_old", "u_1"]);
  });

  it("changes a role and records who did it, from what and to what", async () => {
    const { app, audit, state } = setup("DONOR");
    const res = await request(app).post("/u_1/role").send({ role: "PARTNER" });
    expect(res.status).toBe(200);
    expect(state.role).toBe("PARTNER");
    expect(audit[0]).toMatchObject({ action: "user.role_changed", actorId: "ngo_1", details: { from: "donor", to: "partner" } });
  });

  it("records a first role for an old account as coming from pending", async () => {
    const { app, audit } = setup(null);
    await request(app).post("/u_1/role").send({ role: "DONOR" });
    expect(audit[0]).toMatchObject({ details: { from: "pending", to: "donor" } });
  });

  it("won't let NGO staff change their own access", async () => {
    const { app, audit } = setup();
    expect((await request(app).post("/ngo_1/role").send({ role: "DONOR" })).status).toBe(400);
    expect(audit).toHaveLength(0);
  });

  it("won't let NGO staff change a LIFELINE Admin's access", async () => {
    const { app, audit, state } = setup("ADMIN");
    expect((await request(app).post("/u_1/role").send({ role: "DONOR" })).status).toBe(403);
    expect(state.role).toBe("ADMIN");
    expect(audit).toHaveLength(0);
  });

  it("can't be used to grant Admin access", async () => {
    expect((await request(setup().app).post("/u_1/role").send({ role: "ADMIN" })).status).toBe(400);
  });

  it("rejects an unknown role and a change to the same role", async () => {
    const { app } = setup("PARTNER");
    expect((await request(app).post("/u_1/role").send({ role: "ADMIN" })).status).toBe(400);
    expect((await request(app).post("/u_1/role").send({ role: "PARTNER" })).status).toBe(400);
  });

  it.each(["DONOR", "PARTNER"] as const)("is closed to %s accounts", async (role) => {
    const app = createApp({ resolveSession: async () => ({ id: "x", email: "x@example.test", role }) });
    expect((await request(app).get("/api/team")).status).toBe(403);
    expect((await request(app).post("/api/team/u_1/role").send({ role: "NGO" })).status).toBe(403);
  });
});
