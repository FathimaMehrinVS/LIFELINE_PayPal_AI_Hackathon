import express from "express";
import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import { Prisma } from "../../apps/api/src/generated/prisma/client";
import { createRoleGuard } from "../../apps/api/src/auth/role-guard";
import { errorHandler } from "../../apps/api/src/middleware/error-handler";
import { HttpError } from "../../apps/api/src/utils/http-error";
import { createDeliveryRouter } from "../../apps/api/src/routes/deliveries.routes";
import { getPrisma } from "../../apps/api/src/database/prisma";
import type { AuthRole } from "../../apps/api/src/auth/session";
import { createPickupCode } from "../../apps/api/src/modules/procurement/pickup-code";

const assignment = { allocation_id: "alloc-1", merchant_id: "merchant-1", partner_user_id: "partner-1" };
const NGO = { id: "ngo-1", email: "ngo@example.test", role: "NGO" as const };
const PARTNER = { id: "partner-1", email: "partner@example.test", role: "PARTNER" as const };

function makeAllocation(overrides: Record<string, unknown> = {}) {
  return {
    id: "alloc-1",
    requestId: "case-1",
    status: "APPROVED",
    amount: new Prisma.Decimal("75.00"),
    currency: "EUR",
    request: {
      status: "APPROVED",
      basket: { items: [{ id: "basket-item-1", name: "Water container", quantity: 2 }] },
    },
    donations: [{ amount: new Prisma.Decimal("75.00") }],
    purchaseOrder: null as any,
    ...overrides,
  } as any;
}

function setup(options: { role?: AuthRole; allocation?: any; secondAllocation?: any; capture?: string } = {}) {
  const partner = { id: "partner-1", name: "Local Partner", email: "partner@example.test", role: "PARTNER" };
  const merchant = { id: "merchant-1", name: "Approved Supplier", status: "APPROVED", verified: true };
  const order = { id: "po-1", allocationId: "alloc-1", merchantId: "merchant-1", partnerUserId: null as string | null, fulfilmentStatus: "AWAITING_ACCEPTANCE", pickupCodeHash: null as string | null, pickupAttempts: 0, merchant, partnerUser: null as any, events: [] as any[] };
  const allocation = options.allocation === undefined ? makeAllocation({ purchaseOrder: order }) : options.allocation;
  const tx: any = {
    aidAllocation: {
      findUnique: vi.fn(async () => allocation),
      updateMany: vi.fn(async ({ data }: any) => { Object.assign(allocation, data); return { count: 1 }; }),
    },
    user: { findUnique: vi.fn(async () => partner) },
    merchant: { findUnique: vi.fn(async () => merchant) },
    donation: { aggregate: vi.fn(async () => ({ _sum: { amount: new Prisma.Decimal(options.capture ?? "75.00") } })) },
    purchaseOrder: {
      findUnique: vi.fn(async () => allocation.purchaseOrder),
      updateMany: vi.fn(async ({ data }: any) => {
        if (allocation.purchaseOrder) {
          const { pickupAttempts, ...rest } = data;
          Object.assign(allocation.purchaseOrder, rest);
          if (pickupAttempts?.increment) allocation.purchaseOrder.pickupAttempts += pickupAttempts.increment;
          else if (typeof pickupAttempts === "number") allocation.purchaseOrder.pickupAttempts = pickupAttempts;
        }
        return { count: 1 };
      }),
      create: vi.fn(async ({ data }: any) => { allocation.purchaseOrder = { ...order, ...data }; return allocation.purchaseOrder; }),
      findMany: vi.fn(async () => []),
    },
    fulfilmentEvent: { create: vi.fn(async ({ data }: any) => { const event = { ...data, createdAt: new Date("2026-11-09T10:00:00Z") }; allocation.purchaseOrder?.events.push(event); return event; }) },
    assistanceRequest: { updateMany: vi.fn(async () => ({ count: 1 })) },
    auditLog: { create: vi.fn(async () => ({})), createMany: vi.fn(async () => ({ count: 2 })) },
  };
  const prisma: any = { ...tx, $transaction: vi.fn(async (callback: (transaction: any) => unknown) => callback(tx)) };
  const getDatabase = vi.fn(() => prisma as ReturnType<typeof getPrisma>);
  const resolver = async (authorization: string | undefined) => {
    if (!authorization) throw new HttpError("AUTHENTICATION_REQUIRED", "A verified session is required");
    const role = authorization.includes("donor") ? "DONOR" : authorization.includes("partner") ? "PARTNER" : "NGO";
    return { id: role === "PARTNER" ? PARTNER.id : NGO.id, email: role === "PARTNER" ? PARTNER.email : NGO.email, role: role as AuthRole };
  };
  const app = express();
  app.use(express.json());
  app.use(createRoleGuard(resolver)("NGO", "PARTNER"));
  app.use("/api/deliveries", createDeliveryRouter(getDatabase));
  app.use(errorHandler);
  return { app, allocation, tx, prisma, getDatabase };
}

describe("assistance delivery verification", () => {
  it("requires authentication and rejects donor delivery access", async () => {
    const h = setup();
    expect((await request(h.app).get("/api/deliveries")).status).toBe(401);
    expect((await request(h.app).post("/api/deliveries").set("Authorization", "Bearer donor").send(assignment)).status).toBe(403);
    expect((await request(h.app).post("/api/deliveries/alloc-1/verify").set("Authorization", "Bearer donor").send({})).status).toBe(403);
    expect(h.tx.purchaseOrder.create).not.toHaveBeenCalled();
  });

  it("lets an NGO assign a fully funded approved allocation to an existing partner and supplier", async () => {
    const h = setup();
    const response = await request(h.app).post("/api/deliveries").set("Authorization", "Bearer ngo").send(assignment);
    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({ allocation_id: "alloc-1", case_id: "case-1", fulfilment_status: "awaiting_acceptance", partner: { user_id: "partner-1" }, merchant: { merchant_id: "merchant-1" } });
    expect(h.tx.purchaseOrder.updateMany).toHaveBeenCalledWith(expect.objectContaining({ data: { partnerUserId: "partner-1" } }));
    expect(h.tx.purchaseOrder.create).not.toHaveBeenCalled();
    expect(h.tx.auditLog.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ actorId: "ngo-1", action: "delivery.assigned" }) }));
  });

  it("rejects missing, unapproved, unfunded, and invalid supplier/partner assignments", async () => {
    const missing = setup({ allocation: null });
    expect((await request(missing.app).post("/api/deliveries").set("Authorization", "Bearer ngo").send(assignment)).status).toBe(404);

    const unapproved = setup({ allocation: makeAllocation({ status: "PROPOSED" }) });
    expect((await request(unapproved.app).post("/api/deliveries").set("Authorization", "Bearer ngo").send(assignment)).status).toBe(400);
    expect(unapproved.tx.purchaseOrder.create).not.toHaveBeenCalled();

    const underfunded = setup({ capture: "20.00" });
    const response = await request(underfunded.app).post("/api/deliveries").set("Authorization", "Bearer ngo").send(assignment);
    expect(response.status).toBe(400);
    expect(response.body.error.message).toContain("Captured donations");
  });

  it("records sequential partner preparation and handover with server-derived actor and delivered items", async () => {
    const allocation = makeAllocation({ purchaseOrder: {
      id: "po-1", partnerUserId: "partner-1", fulfilmentStatus: "AWAITING_ACCEPTANCE", pickupCodeHash: null, pickupAttempts: 0, events: [],
      merchant: { id: "merchant-1", name: "Approved Supplier", status: "APPROVED" },
      partnerUser: { id: "partner-1", name: "Local Partner", email: "partner@example.test" },
    } });
    const h = setup({ allocation });
    for (const status of ["accepted", "preparing", "ready", "dispatched"] as const) {
      const response = await request(h.app).post("/api/deliveries/alloc-1/events").set("Authorization", "Bearer partner").send({ status });
      expect(response.status).toBe(200);
    }
    const handover = await request(h.app).post("/api/deliveries/alloc-1/events").set("Authorization", "Bearer partner").send({
      status: "handed_over", delivered_items: [{ basket_item_id: "basket-item-1", quantity: 2 }], note: "Handed over at partner point",
    });
    expect(handover.status).toBe(200);
    expect(handover.body.fulfilment_status).toBe("handed_over");
    expect(handover.body.events.at(-1)).toMatchObject({ status: "handed_over", actor_id: "partner-1", delivered_items: [{ basket_item_id: "basket-item-1", name: "Water container", quantity: 2 }] });
    expect(h.tx.auditLog.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ actorId: "partner-1", action: "delivery.handover_recorded" }) }));
  });

  it("allows only the assigned partner to submit the next lifecycle update", async () => {
    const allocation = makeAllocation({ purchaseOrder: { id: "po-1", partnerUserId: "another-partner", fulfilmentStatus: "AWAITING_ACCEPTANCE", events: [], merchant: { id: "merchant-1", name: "Supplier", status: "APPROVED" }, partnerUser: null } });
    const h = setup({ allocation });
    const response = await request(h.app).post("/api/deliveries/alloc-1/events").set("Authorization", "Bearer partner").send({ status: "accepted" });
    expect(response.status).toBe(404);
    expect(h.tx.purchaseOrder.updateMany).not.toHaveBeenCalled();
  });

  it("rejects skipped transitions and handover items from another case", async () => {
    const invalid = makeAllocation({ purchaseOrder: { id: "po-1", partnerUserId: "partner-1", fulfilmentStatus: "ACCEPTED", events: [], merchant: { id: "merchant-1", name: "Supplier", status: "APPROVED" }, partnerUser: { id: "partner-1", name: "Partner", email: "partner@example.test" } } });
    const h = setup({ allocation: invalid });
    const skipped = await request(h.app).post("/api/deliveries/alloc-1/events").set("Authorization", "Bearer partner").send({ status: "ready" });
    expect(skipped.status).toBe(400);
    expect(h.tx.purchaseOrder.updateMany).not.toHaveBeenCalled();

    invalid.purchaseOrder.fulfilmentStatus = "DISPATCHED";
    const spoofed = await request(h.app).post("/api/deliveries/alloc-1/events").set("Authorization", "Bearer partner").send({ status: "handed_over", delivered_items: [{ basket_item_id: "someone-elses-item", quantity: 1 }] });
    expect(spoofed.status).toBe(400);
  });

  it("prevents a partner from self-verifying its own handover", async () => {
    const h = setup();
    const response = await request(h.app).post("/api/deliveries/alloc-1/verify").set("Authorization", "Bearer partner").send({ pickup_code: "12345678" });
    expect(response.status).toBe(403);
    expect(h.tx.aidAllocation.findUnique).not.toHaveBeenCalled();
  });

  it("allows NGO verification only after a recorded handover, completes the allocation and audits both transitions", async () => {
    const pickup = createPickupCode();
    const handoverEvent = { status: "HANDED_OVER", actorId: "partner-1", note: "Picked up at the local point", evidenceType: "SUPPLIER_CONFIRMATION", deliveredItems: [{ basket_item_id: "basket-item-1", name: "Water container", quantity: 2 }], createdAt: new Date("2026-11-09T09:00:00Z") };
    const order = { id: "po-1", allocationId: "alloc-1", merchantId: "merchant-1", partnerUserId: "partner-1", fulfilmentStatus: "HANDED_OVER", pickupCodeHash: pickup.hash, pickupAttempts: 0, merchant: { id: "merchant-1", name: "Approved Supplier", status: "APPROVED" }, partnerUser: { id: "partner-1", name: "Local Partner", email: "partner@example.test" }, events: [handoverEvent] };
    const allocation = makeAllocation({ purchaseOrder: order });
    const h = setup({ allocation });
    h.tx.aidAllocation.findUnique.mockResolvedValueOnce(allocation).mockImplementation(async () => ({ ...allocation, status: "COMPLETED", purchaseOrder: { ...order, fulfilmentStatus: "RECIPIENT_CONFIRMED", pickupCodeHash: null, events: [...order.events, { status: "RECIPIENT_CONFIRMED", actorId: "ngo-1", note: "Handover checked", evidenceType: "PICKUP_CODE", deliveredItems: null, createdAt: new Date("2026-11-09T10:00:00Z") }] } }));
    const response = await request(h.app).post("/api/deliveries/alloc-1/verify").set("Authorization", "Bearer ngo").send({ pickup_code: pickup.code, note: "Handover checked" });
    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ allocation_status: "completed", fulfilment_status: "recipient_confirmed", case_id: "case-1" });
    expect(h.tx.assistanceRequest.updateMany).toHaveBeenCalledWith(expect.objectContaining({ data: { status: "COMPLETED" } }));
    expect(h.tx.fulfilmentEvent.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: "RECIPIENT_CONFIRMED", actorId: "ngo-1", evidenceType: "PICKUP_CODE" }) }));
    expect(h.tx.auditLog.createMany).toHaveBeenCalledWith(expect.objectContaining({ data: expect.arrayContaining([
      expect.objectContaining({ actorId: "ngo-1", action: "delivery.recipient_confirmed", entityId: "alloc-1" }),
      expect.objectContaining({ actorId: "ngo-1", action: "allocation.completed", entityId: "alloc-1" }),
    ]) }));
    expect(h.tx.auditLog.createMany.mock.calls[0]?.[0].data).toEqual(expect.arrayContaining([
      expect.objectContaining({ action: "delivery.recipient_confirmed", details: expect.objectContaining({ shortfall_accepted: false, shortfall_reason: null, shortfalls: [] }) }),
    ]));
  });

  it("rejects a partial handover until the NGO explicitly accepts the shortfall with a reason", async () => {
    const pickup = createPickupCode();
    const handoverEvent = { status: "HANDED_OVER", actorId: "partner-1", note: null, evidenceType: "SUPPLIER_CONFIRMATION", deliveredItems: [{ basket_item_id: "basket-item-1", name: "Water container", quantity: 1 }], createdAt: new Date("2026-11-09T09:00:00Z") };
    const order = { id: "po-1", allocationId: "alloc-1", merchantId: "merchant-1", partnerUserId: "partner-1", fulfilmentStatus: "HANDED_OVER", pickupCodeHash: pickup.hash, pickupAttempts: 0, merchant: { id: "merchant-1", name: "Approved Supplier", status: "APPROVED" }, partnerUser: { id: "partner-1", name: "Local Partner", email: "partner@example.test" }, events: [handoverEvent] };
    const allocation = makeAllocation({ purchaseOrder: order });
    const h = setup({ allocation });

    const response = await request(h.app).post("/api/deliveries/alloc-1/verify").set("Authorization", "Bearer ngo").send({ pickup_code: pickup.code, note: "The recipient was present" });

    expect(response.status).toBe(400);
    expect(response.body.error.message).toContain("Delivery quantities are incomplete");
    expect(response.body.error.details.shortfalls).toEqual([{ basket_item_id: "basket-item-1", name: "Water container", planned_quantity: 2, delivered_quantity: 1 }]);
    expect(h.tx.purchaseOrder.updateMany).not.toHaveBeenCalled();
    expect(h.tx.aidAllocation.updateMany).not.toHaveBeenCalled();
    expect(h.tx.auditLog.createMany).not.toHaveBeenCalled();
  });

  it("allows the NGO to accept and record a partial-delivery shortfall with a reason", async () => {
    const pickup = createPickupCode();
    const handoverEvent = { status: "HANDED_OVER", actorId: "partner-1", note: null, evidenceType: "SUPPLIER_CONFIRMATION", deliveredItems: [{ basket_item_id: "basket-item-1", name: "Water container", quantity: 1 }], createdAt: new Date("2026-11-09T09:00:00Z") };
    const order = { id: "po-1", allocationId: "alloc-1", merchantId: "merchant-1", partnerUserId: "partner-1", fulfilmentStatus: "HANDED_OVER", pickupCodeHash: pickup.hash, pickupAttempts: 0, merchant: { id: "merchant-1", name: "Approved Supplier", status: "APPROVED" }, partnerUser: { id: "partner-1", name: "Local Partner", email: "partner@example.test" }, events: [handoverEvent] };
    const allocation = makeAllocation({ purchaseOrder: order });
    const h = setup({ allocation });
    h.tx.aidAllocation.findUnique.mockResolvedValueOnce(allocation).mockImplementation(async () => ({ ...allocation, status: "COMPLETED", purchaseOrder: { ...order, fulfilmentStatus: "RECIPIENT_CONFIRMED", pickupCodeHash: null, events: [...order.events, { status: "RECIPIENT_CONFIRMED", actorId: "ngo-1", note: "Shortfall accepted by NGO: supplier ran out of stock", evidenceType: "PICKUP_CODE", deliveredItems: null, createdAt: new Date("2026-11-09T10:00:00Z") }] } }));

    const response = await request(h.app).post("/api/deliveries/alloc-1/verify").set("Authorization", "Bearer ngo").send({ pickup_code: pickup.code, accept_shortfall: true, shortfall_reason: "Supplier ran out of stock" });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ allocation_status: "completed", fulfilment_status: "recipient_confirmed" });
    expect(h.tx.fulfilmentEvent.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ actorId: "ngo-1", note: "Shortfall accepted by NGO: Supplier ran out of stock" }) }));
    expect(h.tx.auditLog.createMany.mock.calls[0]?.[0].data).toEqual(expect.arrayContaining([
      expect.objectContaining({ actorId: "ngo-1", action: "delivery.recipient_confirmed", details: expect.objectContaining({ shortfall_accepted: true, shortfall_reason: "Supplier ran out of stock", shortfalls: [{ basket_item_id: "basket-item-1", name: "Water container", planned_quantity: 2, delivered_quantity: 1 }] }) }),
    ]));
  });

  it("requires a shortfall reason at request validation time", async () => {
    const h = setup();
    const response = await request(h.app).post("/api/deliveries/alloc-1/verify").set("Authorization", "Bearer ngo").send({ pickup_code: "12345678", accept_shortfall: true });
    expect(response.status).toBe(400);
    expect(response.body.error.details).toEqual(expect.arrayContaining([expect.objectContaining({ path: "shortfall_reason" })]));
    expect(h.tx.aidAllocation.findUnique).not.toHaveBeenCalled();
  });
});
