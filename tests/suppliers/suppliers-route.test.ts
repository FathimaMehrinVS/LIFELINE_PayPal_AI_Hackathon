import express from "express";
import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import { createApp } from "../../apps/api/src/app";
import { requireApprovedSupplier } from "../../apps/api/src/modules/suppliers/supplier.service";
import { createSupplierRouter } from "../../apps/api/src/routes/suppliers.routes";
import { errorHandler } from "../../apps/api/src/middleware/error-handler";

const row = (status = "PENDING") => ({
  id: "sup_1", name: "Demo Shop (synthetic)", location: "Demo Town", serviceAreas: ["Demo Town"], categories: ["food"], accepts: ["Bank transfer"], contact: null, status,
  createdAt: new Date("2026-11-01T00:00:00Z"), purchaseOrders: [{ fulfilmentStatus: "RECIPIENT_CONFIRMED" }, { fulfilmentStatus: "ACCEPTED" }], incidents: [],
});

function setup(status = "PENDING") {
  const state = { status };
  const audit: { action: string; actorId: string; details: unknown }[] = [];
  const merchant = {
    findUnique: vi.fn(async ({ select }: { select?: unknown }) => (select ? { status: state.status } : row(state.status))),
    findMany: vi.fn(async () => [row(state.status)]),
    create: vi.fn(async () => ({ id: "sup_1" })),
    update: vi.fn(async ({ data }: { data: { status: string } }) => { state.status = data.status; return {}; }),
  };
  const auditLog = { create: vi.fn(async ({ data }: { data: (typeof audit)[number] }) => { audit.push(data); return {}; }), findMany: vi.fn(async () => []) };
  const db = { merchant, auditLog, $transaction: async (work: (tx: unknown) => Promise<unknown>) => work({ merchant, auditLog }) };
  const app = express();
  app.use(express.json());
  app.use((_req, res, next) => { res.locals.authSession = { id: "ngo_1", email: "n@example.test", role: "NGO" }; next(); });
  app.use("/", createSupplierRouter((() => db) as never));
  app.use(errorHandler);
  return { app, audit, merchant, state };
}

describe("supplier API", () => {
  it("lists suppliers with a scorecard that ignores orders still in progress", async () => {
    const res = await request(setup().app).get("/");
    expect(res.status).toBe(200);
    expect(res.body[0]).toMatchObject({ supplier_id: "sup_1", status: "pending", scorecard: { orders_finished: 1, orders_completed: 1 } });
  });

  it("always registers a new supplier as pending, and audits it", async () => {
    const { app, merchant, audit } = setup();
    const res = await request(app).post("/").send({ name: "New Shop", location: "Demo Town", categories: ["food"], status: "approved" });
    expect(res.status).toBe(201);
    expect(merchant.create.mock.calls[0]![0 as never]).toMatchObject({ data: { status: "PENDING" } });
    expect(audit[0]).toMatchObject({ action: "supplier.registered", actorId: "ngo_1" });
  });

  it("requires a reason for a decision", async () => {
    expect((await request(setup().app).post("/sup_1/status").send({ status: "approved" })).status).toBe(400);
  });

  it("records who changed a status, from what, to what and why", async () => {
    const { app, audit, state } = setup();
    const res = await request(app).post("/sup_1/status").send({ status: "approved", reason: "Registration papers checked" });
    expect(res.status).toBe(200);
    expect(state.status).toBe("APPROVED");
    expect(audit[0]).toMatchObject({ action: "supplier.status_changed", actorId: "ngo_1", details: { from: "pending", to: "approved", reason: "Registration papers checked" } });
  });

  it("rejects a change to the same status", async () => {
    expect((await request(setup("APPROVED").app).post("/sup_1/status").send({ status: "approved", reason: "Checked again" })).status).toBe(400);
  });

  it.each(["SUSPENDED", "PENDING"])("won't let a %s supplier receive an order", async (status) => {
    const { merchant } = setup(status);
    await expect(requireApprovedSupplier({ merchant } as never, "sup_1")).rejects.toThrow("Only an approved supplier");
  });

  it("allows an approved supplier", async () => {
    const { merchant } = setup("APPROVED");
    await expect(requireApprovedSupplier({ merchant } as never, "sup_1")).resolves.toBeUndefined();
  });

  it.each(["DONOR", "PARTNER"] as const)("is closed to %s accounts", async (role) => {
    const app = createApp({ resolveSession: async () => ({ id: "x", email: "x@example.test", role }) });
    expect((await request(app).get("/api/suppliers")).status).toBe(403);
  });
});
