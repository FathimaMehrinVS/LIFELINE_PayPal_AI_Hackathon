import express from "express";
import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import { Prisma } from "../../apps/api/src/generated/prisma/client";
import { errorHandler } from "../../apps/api/src/middleware/error-handler";
import { createAllocationRouter } from "../../apps/api/src/routes/allocation.routes";
import { getPrisma } from "../../apps/api/src/database/prisma";
import { createRoleGuard } from "../../apps/api/src/auth/role-guard";

function setup(options: { caseStatus?: string; caseExists?: boolean; campaignExists?: boolean; supplierStatus?: string; paymentConflict?: boolean } = {}) {
  const assistance: any = {
    id: "case_1",
    status: options.caseStatus ?? "AWAITING_APPROVAL",
    situation: { budget: new Prisma.Decimal("100.00"), currency: "EUR" },
    financial: { recommendedRouteId: "route_paypal", routes: [{ route_id: "route_paypal", verdict: "pass" }] },
    basket: { id: "basket_1", total: new Prisma.Decimal("70.00"), currency: "EUR", items: [{ id: "item_1" }] },
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
    merchant: {
      findUnique: vi.fn(async () => ({ id: "supplier_1", status: options.supplierStatus ?? "APPROVED" })),
    },
    supplierIncident: {
      findMany: vi.fn(async () => options.paymentConflict ? [{ description: "Supplier bank account details changed" }] : []),
    },
    aidAllocation: {
      findUnique: vi.fn(async () => assistance.allocation),
      create: vi.fn(async ({ data }: any) => {
        const allocation = { id: `allocation_${++allocationId}`, purchaseOrder: null, ...data };
        assistance.allocation = allocation;
        return allocation;
      }),
      update: vi.fn(async ({ data }: any) => {
        Object.assign(assistance.allocation, data);
        return assistance.allocation;
      }),
    },
    purchaseOrder: {
      create: vi.fn(async ({ data }: any) => ({ id: "purchase_order_1", merchantId: data.merchantId, ...data })),
    },
    fulfilmentEvent: { create: vi.fn(async ({ data }: any) => data) },
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

const validRequest = { case_id: "case_1", campaign_id: "camp_demo", merchant_id: "supplier_1" };

describe("NGO allocation approval", () => {
  it("calculates basket total plus route fee and creates the purchase order atomically", async () => {
    const h = setup();
    const response = await request(h.app).post("/api/allocations/approve").send({ ...validRequest, amount: 100, currency: "EUR" });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      allocation_id: "allocation_1", purchase_order_id: "purchase_order_1", case_id: "case_1", status: "approved", amount: 73.5, currency: "EUR",
    });
    expect(response.body.approved_at).toEqual(expect.any(String));
    expect(h.assistance.status).toBe("APPROVED");
    expect(h.tx.aidAllocation.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({
      requestId: "case_1", campaignId: "camp_demo", amount: new Prisma.Decimal(73.5), currency: "EUR", status: "APPROVED",
    }) }));
    expect(h.tx.purchaseOrder.create).toHaveBeenCalledWith({ data: expect.objectContaining({
      allocationId: "allocation_1", merchantId: "supplier_1", amount: new Prisma.Decimal(73.5), currency: "EUR", fulfilmentStatus: "AWAITING_ACCEPTANCE",
    }), select: { id: true, merchantId: true } });
    expect(h.tx.auditLog.create).toHaveBeenCalledWith({ data: expect.objectContaining({
      actorId: "verified-ngo-profile", action: "allocation.approved", entityType: "AidAllocation", entityId: "allocation_1",
    }) });
    expect(h.prisma.$transaction).toHaveBeenCalledWith(expect.any(Function), {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    });
  });

  it("validates the request before accessing the database", async () => {
    const h = setup();
    const response = await request(h.app).post("/api/allocations/approve").send({ case_id: "case_1", campaign_id: "camp_demo" });
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

  it.each(["PENDING", "SUSPENDED"]) ("rejects a %s supplier", async (supplierStatus) => {
    const h = setup({ supplierStatus });
    const response = await request(h.app).post("/api/allocations/approve").send(validRequest);
    expect(response.status).toBe(400);
    expect(response.body.error.message).toContain("approved supplier");
    expect(h.tx.aidAllocation.create).not.toHaveBeenCalled();
  });

  it("holds approval when an open supplier incident reports conflicting payment details", async () => {
    const h = setup({ paymentConflict: true });
    const response = await request(h.app).post("/api/allocations/approve").send(validRequest);

    expect(response.status).toBe(400);
    expect(response.body.error.message).toContain("payment-details conflict");
    expect(h.tx.aidAllocation.create).not.toHaveBeenCalled();
    expect(h.tx.purchaseOrder.create).not.toHaveBeenCalled();
  });

  it("refuses a supplier that the basket's items don't come from", async () => {
    const h = setup();
    h.assistance.basket.items = [{ id: "item_1", merchantId: "another_supplier" }];
    const response = await request(h.app).post("/api/allocations/approve").send(validRequest);
    expect(response.status).toBe(400);
    expect(response.body.error.message).toContain("supplier this basket");
    expect(h.tx.aidAllocation.create).not.toHaveBeenCalled();
  });

  it("rejects a case that is not awaiting approval or lacks a basket", async () => {
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

  it("rejects an amount that exceeds the case budget", async () => {
    const h = setup();
    h.assistance.basket.total = new Prisma.Decimal("99.00");
    const response = await request(h.app).post("/api/allocations/approve").send(validRequest);
    expect(response.status).toBe(400);
    expect(response.body.error.message).toContain("budget");
    expect(h.tx.aidAllocation.create).not.toHaveBeenCalled();
  });

  it("returns an existing matching approval without creating a duplicate", async () => {
    const h = setup({ caseStatus: "APPROVED" });
    h.assistance.allocation = {
      id: "allocation_existing", requestId: "case_1", campaignId: "camp_demo", amount: new Prisma.Decimal("73.50"),
      currency: "EUR", status: "APPROVED", approvedAt: new Date("2026-11-07T10:00:00.000Z"),
      purchaseOrder: { id: "purchase_order_existing", merchantId: "supplier_1" },
    };
    const response = await request(h.app).post("/api/allocations/approve").send(validRequest);
    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ allocation_id: "allocation_existing", purchase_order_id: "purchase_order_existing", status: "approved" });
    expect(h.tx.aidAllocation.create).not.toHaveBeenCalled();
    expect(h.tx.purchaseOrder.create).not.toHaveBeenCalled();
  });
});
