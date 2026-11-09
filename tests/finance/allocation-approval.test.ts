import express from "express";
import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import { Prisma } from "../../apps/api/src/generated/prisma/client";
import { errorHandler } from "../../apps/api/src/middleware/error-handler";
import { createAllocationRouter } from "../../apps/api/src/routes/allocation.routes";
import { getPrisma } from "../../apps/api/src/database/prisma";
import { createRoleGuard } from "../../apps/api/src/auth/role-guard";

function setup(options: {
  caseStatus?: string;
  caseExists?: boolean;
  campaignExists?: boolean;
  captured?: string;
  allocated?: string;
} = {}) {
  const assistance: any = {
    id: "case_1",
    status: options.caseStatus ?? "AWAITING_APPROVAL",
    situation: { budget: new Prisma.Decimal("100.00"), currency: "EUR" },
    basket: { id: "basket_1" },
    allocation: null,
  };
  let allocationId = 0;
  const tx: any = {
    assistanceRequest: {
      findUnique: vi.fn(async () => options.caseExists === false ? null : assistance),
      update: vi.fn(async ({ data }: any) => { Object.assign(assistance, data); return assistance; }),
    },
    campaign: {
      findUnique: vi.fn(async () => options.campaignExists === false ? null : { id: "camp_demo", active: true, currency: "EUR" }),
    },
    donation: {
      aggregate: vi.fn(),
    },
    aidAllocation: {
      aggregate: vi.fn(),
      findUnique: vi.fn(async () => assistance.allocation),
      create: vi.fn(async ({ data }: any) => {
        const allocation = { id: `allocation_${++allocationId}`, ...data };
        assistance.allocation = allocation;
        return allocation;
      }),
      update: vi.fn(async ({ data }: any) => {
        Object.assign(assistance.allocation, data);
        return assistance.allocation;
      }),
    },
    auditLog: { create: vi.fn(async ({ data }: any) => data) },
  };
  const prisma: any = {
    ...tx,
    $transaction: vi.fn(async (callback: (transaction: any) => unknown) => callback(tx)),
  };
  const getDatabase = vi.fn(() => prisma as ReturnType<typeof getPrisma>);
  const app = express();
  app.use(express.json());
  app.use(createRoleGuard(async () => ({ id: "verified-ngo-profile", email: "ngo@example.test", role: "NGO" }))("NGO"));
  app.use("/api/allocations", createAllocationRouter(getDatabase));
  app.use(errorHandler);
  return { app, assistance, tx, prisma, getDatabase };
}

const validRequest = { case_id: "case_1", campaign_id: "camp_demo", amount: 80, currency: "EUR" };

describe("NGO allocation approval", () => {
  it("approves an eligible case within captured campaign funds and persists an audit entry", async () => {
    const h = setup();
    const response = await request(h.app).post("/api/allocations/approve").send({ ...validRequest, actor_id: "spoofed-profile" });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      allocation_id: "allocation_1", case_id: "case_1", status: "approved", amount: 80, currency: "EUR",
    });
    expect(response.body.approved_at).toEqual(expect.any(String));
    expect(h.assistance.status).toBe("APPROVED");
    expect(h.tx.aidAllocation.create).toHaveBeenCalledWith({ data: expect.objectContaining({
      requestId: "case_1", campaignId: "camp_demo", amount: new Prisma.Decimal(80), currency: "EUR", status: "APPROVED",
    }) });
    expect(h.tx.auditLog.create).toHaveBeenCalledWith({ data: expect.objectContaining({
      actorId: "verified-ngo-profile", action: "allocation.approved", entityType: "AidAllocation", entityId: "allocation_1",
    }) });
    expect(h.prisma.$transaction).toHaveBeenCalledWith(expect.any(Function), {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    });
  });

  it("validates the request before accessing the database", async () => {
    const h = setup();
    const response = await request(h.app).post("/api/allocations/approve").send({ ...validRequest, amount: 0 });
    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("VALIDATION_ERROR");
    expect(h.getDatabase).not.toHaveBeenCalled();
  });

  it("returns NOT_FOUND when the assistance case does not exist", async () => {
    const h = setup({ caseExists: false });
    const response = await request(h.app).post("/api/allocations/approve").send(validRequest);
    expect(response.status).toBe(404);
    expect(response.body.error.message).toContain("case not found");
    expect(h.tx.aidAllocation.create).not.toHaveBeenCalled();
  });

  it("rejects a case that is not awaiting approval or lacks its completed basket", async () => {
    const h = setup({ caseStatus: "ANALYZED" });
    const response = await request(h.app).post("/api/allocations/approve").send(validRequest);
    expect(response.status).toBe(400);
    expect(response.body.error.message).toContain("not ready");
    expect(h.tx.aidAllocation.create).not.toHaveBeenCalled();
  });

  it("returns NOT_FOUND when the campaign is missing or inactive", async () => {
    const h = setup({ campaignExists: false });
    const response = await request(h.app).post("/api/allocations/approve").send(validRequest);
    expect(response.status).toBe(404);
    expect(h.tx.aidAllocation.create).not.toHaveBeenCalled();
  });

  it("approves an eligible allocation before donations have been captured", async () => {
    const h = setup({ captured: "0.00", allocated: "0.00" });
    const response = await request(h.app).post("/api/allocations/approve").send(validRequest);
    expect(response.status).toBe(200);
    expect(response.body.status).toBe("approved");
    expect(h.tx.donation.aggregate).not.toHaveBeenCalled();
  });

  it("rejects a case or campaign currency mismatch", async () => {
    const h = setup();
    const response = await request(h.app).post("/api/allocations/approve").send({ ...validRequest, currency: "USD" });
    expect(response.status).toBe(400);
    expect(h.tx.aidAllocation.create).not.toHaveBeenCalled();
  });

  it("returns the existing matching approval without creating a duplicate", async () => {
    const h = setup({ caseStatus: "APPROVED" });
    h.assistance.allocation = {
      id: "allocation_existing", requestId: "case_1", campaignId: "camp_demo", amount: new Prisma.Decimal("80.00"),
      currency: "EUR", status: "APPROVED", approvedAt: new Date("2026-11-07T10:00:00.000Z"),
    };
    const response = await request(h.app).post("/api/allocations/approve").send(validRequest);
    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ allocation_id: "allocation_existing", status: "approved" });
    expect(h.tx.aidAllocation.create).not.toHaveBeenCalled();
    expect(h.tx.auditLog.create).not.toHaveBeenCalled();
  });
});
