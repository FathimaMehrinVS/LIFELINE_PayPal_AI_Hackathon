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

type CheckLog = { action: string; details: unknown; createdAt: Date; actor: null };
const CHECK_KEYS = ["business_registration", "owner_identity", "business_address", "payment_account", "sanctions_screening", "ngo_reference"];
const log = (check: string, to: string, reason: string): CheckLog => ({ action: "supplier.check_recorded", details: { check, to, reason }, createdAt: new Date("2026-11-02T00:00:00Z"), actor: null });
const allVerified = () => CHECK_KEYS.map((key) => log(key, "verified", "Evidence reference"));

function setup(status = "PENDING", checks: CheckLog[] = []) {
  const state = { status };
  const audit: { action: string; actorId: string; details: unknown }[] = [];
  const merchant = {
    findUnique: vi.fn(async ({ select }: { select?: unknown }) => (select ? { status: state.status } : row(state.status))),
    findMany: vi.fn(async () => [row(state.status)]),
    create: vi.fn(async () => ({ id: "sup_1" })),
    update: vi.fn(async ({ data }: { data: { status: string } }) => { state.status = data.status; return {}; }),
  };
  const auditLog = { create: vi.fn(async ({ data }: { data: (typeof audit)[number] }) => { audit.push(data); return {}; }), findMany: vi.fn(async () => checks) };
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
    const { app, audit, state } = setup("PENDING", allVerified());
    const res = await request(app).post("/sup_1/status").send({ status: "approved", reason: "Registration papers checked" });
    expect(res.status).toBe(200);
    expect(state.status).toBe("APPROVED");
    expect(audit[0]).toMatchObject({ action: "supplier.status_changed", actorId: "ngo_1", details: { from: "pending", to: "approved", reason: "Registration papers checked" } });
  });

  it("refuses approval until every check is verified", async () => {
    const { app, state, audit } = setup("PENDING", allVerified().slice(1));
    const res = await request(app).post("/sup_1/status").send({ status: "approved", reason: "Looks fine to me" });
    expect(res.status).toBe(400);
    expect(res.body.error.message).toContain("Business registration");
    expect(state.status).toBe("PENDING");
    expect(audit).toHaveLength(0);
  });

  it("uses the latest result, so a check that later fails blocks approval", async () => {
    const { app, state } = setup("PENDING", [log("owner_identity", "failed", "Document did not match"), ...allVerified()]);
    expect((await request(app).post("/sup_1/status").send({ status: "approved", reason: "Trying again" })).status).toBe(400);
    expect(state.status).toBe("PENDING");
  });

  it("also blocks reinstating a suspended supplier without checks", async () => {
    expect((await request(setup("SUSPENDED").app).post("/sup_1/status").send({ status: "approved", reason: "Problem resolved" })).status).toBe(400);
  });

  it("lets a reviewer suspend a supplier without any checks", async () => {
    expect((await request(setup("PENDING").app).post("/sup_1/status").send({ status: "suspended", reason: "Complaint received" })).status).toBe(200);
  });

  it("records a check with who, what changed and the evidence", async () => {
    const { app, audit } = setup();
    const res = await request(app).post("/sup_1/checks").send({ key: "business_registration", state: "verified", evidence: "Registry extract EV-1" });
    expect(res.status).toBe(200);
    expect(audit[0]).toMatchObject({ action: "supplier.check_recorded", actorId: "ngo_1", details: { check: "business_registration", from: "not_checked", to: "verified", reason: "Registry extract EV-1" } });
  });

  it.each(["verified", "failed"])("needs evidence to mark a check %s", async (state) => {
    expect((await request(setup().app).post("/sup_1/checks").send({ key: "owner_identity", state })).status).toBe(400);
  });

  it("allows a check to be in review without evidence", async () => {
    expect((await request(setup().app).post("/sup_1/checks").send({ key: "owner_identity", state: "in_review" })).status).toBe(200);
  });

  it("shows every check, unchecked ones included, and keeps them out of the decision history", async () => {
    const res = await request(setup("PENDING", [log("owner_identity", "verified", "Seen in person")]).app).get("/sup_1");
    expect(res.body.checks).toHaveLength(6);
    expect(res.body.checks.find((check: { key: string }) => check.key === "owner_identity")).toMatchObject({ state: "verified", evidence: "Seen in person" });
    expect(res.body.checks.find((check: { key: string }) => check.key === "ngo_reference")).toMatchObject({ state: "not_checked" });
    expect(res.body.history).toEqual([]);
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
