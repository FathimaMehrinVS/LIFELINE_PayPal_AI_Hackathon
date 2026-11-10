import express from "express";
import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import { Prisma } from "../../apps/api/src/generated/prisma/client";
import { errorHandler } from "../../apps/api/src/middleware/error-handler";
import { createPayoutRouter } from "../../apps/api/src/routes/payout.routes";
import { getPrisma } from "../../apps/api/src/database/prisma";
import { createRoleGuard } from "../../apps/api/src/auth/role-guard";

function setup(options: { allocationExists?: boolean; allocationStatus?: string; captured?: string } = {}) {
  const allocation: any = {
    id: "allocation-1",
    requestId: "case-1",
    campaignId: "campaign-1",
    amount: new Prisma.Decimal("75.00"),
    currency: "EUR",
    status: options.allocationStatus ?? "APPROVED",
    request: { id: "case-1", status: "APPROVED" },
    campaign: { id: "campaign-1", currency: "EUR" },
  };
  const order: any = {
    id: "purchase-order-1",
    allocationId: allocation.id,
    merchant: { status: "APPROVED" },
    amount: allocation.amount,
    currency: allocation.currency,
    allocation,
  };
  let payoutRow: any = null;
  const tx: any = {
    purchaseOrder: {
      findUnique: vi.fn(async () => options.allocationExists === false ? null : order),
    },
    aidAllocation: {
      updateMany: vi.fn(async ({ where, data }: any) => {
        if (allocation.id !== where.id || allocation.status !== where.status) return { count: 0 };
        Object.assign(allocation, data);
        return { count: 1 };
      }),
    },
    donation: {
      aggregate: vi.fn(async () => ({ _sum: { amount: new Prisma.Decimal(options.captured ?? "75.00") } })),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    payout: {
      findFirst: vi.fn(async () => payoutRow),
      aggregate: vi.fn(async () => ({ _sum: { amount: new Prisma.Decimal(0) } })),
      create: vi.fn(async ({ data }: any) => {
        payoutRow = { id: "payout-1", ...data, paypalBatchId: null, createdAt: new Date() };
        return payoutRow;
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
  app.use("/api/payments", createPayoutRouter(getDatabase));
  app.use(errorHandler);
  return { app, allocation, tx, prisma, getDatabase, getPayout: () => payoutRow };
}

const requestBody = { purchase_order_id: "purchase-order-1", reference: "invoice-2026-001" };

describe("simulated assistance disbursement", () => {
  it("returns NOT_FOUND for a missing purchase order", async () => {
    const h = setup({ allocationExists: false });
    const response = await request(h.app).post("/api/payments/payouts").send(requestBody);
    expect(response.status).toBe(404);
    expect(h.tx.payout.create).not.toHaveBeenCalled();
  });

  it("rejects an allocation that is not APPROVED", async () => {
    const h = setup({ allocationStatus: "PROPOSED" });
    const response = await request(h.app).post("/api/payments/payouts").send(requestBody);
    expect(response.status).toBe(400);
    expect(response.body.error.message).toContain("approved");
    expect(h.tx.payout.create).not.toHaveBeenCalled();
  });

  it.each([
    ["empty purchase order id", { ...requestBody, purchase_order_id: "" }],
    ["empty reference", { ...requestBody, reference: " " }],
  ])("rejects invalid %s", async (_label, body) => {
    const h = setup();
    const response = await request(h.app).post("/api/payments/payouts").send(body);
    expect(response.status).toBe(400);
    expect(h.tx.payout.create).not.toHaveBeenCalled();
  });

  it("rejects a case that is no longer approved", async () => {
    const h = setup();
    h.allocation.request.status = "AWAITING_APPROVAL";
    const response = await request(h.app).post("/api/payments/payouts").send(requestBody);
    expect(response.status).toBe(400);
    expect(response.body.error.message).toContain("approved assistance case");
    expect(h.tx.payout.create).not.toHaveBeenCalled();
  });

  it("does not disburse when captured campaign funds are insufficient", async () => {
    const h = setup({ captured: "74.99" });
    const response = await request(h.app).post("/api/payments/payouts").send(requestBody);
    expect(response.status).toBe(400);
    expect(response.body.error.message).toContain("Captured campaign donations are insufficient");
    expect(h.tx.aidAllocation.updateMany).not.toHaveBeenCalled();
    expect(h.tx.payout.create).not.toHaveBeenCalled();
  });

  it("records an unmistakably simulated disbursement and audit entry without changing Donation state", async () => {
    const h = setup();
    const response = await request(h.app).post("/api/payments/payouts").send({ ...requestBody, actor_id: "spoofed-profile" });

    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({
      payout_id: "payout-1", allocation_id: "allocation-1", purchase_order_id: "purchase-order-1", reference: "invoice-2026-001", status: "completed", amount: 75,
      currency: "EUR", mode: "simulated",
    });
    expect(response.body.notice).toContain("no money was transferred to the recipient");
    expect(h.allocation.status).toBe("DISBURSED");
    expect(h.getPayout()).toMatchObject({ allocationId: "allocation-1", purchaseOrderId: "purchase-order-1", reference: "invoice-2026-001", status: "COMPLETED", mode: "SIMULATED" });
    expect(h.tx.auditLog.create).toHaveBeenCalledOnce();
    expect(h.tx.auditLog.create.mock.calls[0]?.[0].data).toMatchObject({
      actorId: "verified-ngo-profile", action: "supplier.payment_simulated", entityId: "purchase-order-1",
      details: expect.objectContaining({ mode: "SIMULATED" }),
    });
    expect(h.tx.auditLog.create.mock.calls[0]?.[0].data.details.notice).toContain("no money was transferred");
    expect(h.tx.donation.aggregate).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ status: "CAPTURED" }) }));
    expect(h.tx.donation.update).not.toHaveBeenCalled();
    expect(h.tx.donation.updateMany).not.toHaveBeenCalled();
  });

  it("returns the existing disbursement on repeat without creating another payout", async () => {
    const h = setup();
    const first = await request(h.app).post("/api/payments/payouts").send(requestBody);
    const second = await request(h.app).post("/api/payments/payouts").send(requestBody);

    expect(first.status).toBe(201);
    expect(second.status).toBe(200);
    expect(second.body).toMatchObject({ payout_id: "payout-1", mode: "simulated" });
    expect(h.tx.payout.create).toHaveBeenCalledOnce();
    expect(h.tx.auditLog.create).toHaveBeenCalledOnce();
  });
});
