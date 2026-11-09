import { describe, expect, it, vi } from "vitest";
import { createApp } from "../../apps/api/src/app";
import { getLedger, getAuditRecords } from "../../apps/api/src/modules/records/records.service";
import { getPlan, listContributions, listPlans, planSteps } from "../../apps/api/src/modules/plans/plan.service";
import request from "supertest";

const dec = (value: number) => ({ toNumber: () => value, toFixed: (places: number) => value.toFixed(places) });

// A row as the database would hold it, including private fields a leak would expose.
const row = (overrides: Record<string, unknown> = {}) => ({
  id: "alloc_abcdef123456",
  requestId: "case_1",
  amount: dec(100),
  currency: "EUR",
  status: "APPROVED",
  approvedAt: new Date("2026-11-01T10:00:00Z"),
  campaign: { active: true },
  request: {
    status: "APPROVED",
    message: "PRIVATE-MESSAGE",
    location: "PRIVATE-LOCATION",
    situation: { needs: ["food", "medicine"], urgency: "HIGH", summary: "PRIVATE-SUMMARY" },
    basket: { total: dec(40), items: [{ name: "Rice, 2 kg", merchantName: "Community Market (synthetic)", quantity: 2, subtotal: dec(40), priceLabel: "Estimated" }] },
  },
  donations: [{ amount: dec(25), updatedAt: new Date("2026-11-02T10:00:00Z") }],
  payouts: [],
  purchaseOrder: null,
  ...overrides,
});

// Honours `select` the way Prisma does, so a field the service does not ask for cannot reach its output.
function pick(source: unknown, select: unknown): unknown {
  if (select === true) return source;
  if (Array.isArray(source)) return source.map((entry) => pick(entry, select));
  if (source === null || typeof source !== "object" || source instanceof Date || typeof (source as { toNumber?: unknown }).toNumber === "function") return source;
  const shape = (select as { select?: Record<string, unknown> }).select ?? (select as Record<string, unknown>);
  return Object.fromEntries(Object.entries(shape).filter(([key]) => key in (source as object)).map(([key, value]) => [key, pick((source as Record<string, unknown>)[key], value)]));
}

function db(rows = [row()]) {
  return {
    aidAllocation: {
      findMany: vi.fn(async ({ select }: { select: unknown }) => rows.map((item) => pick(item, select))),
      findFirst: vi.fn(async ({ select, where }: { select: unknown; where: { id: string } }) => {
        const found = rows.find((item) => item.id === where.id);
        return found ? pick(found, select) : null;
      }),
    },
    donation: {
      findMany: vi.fn(async ({ select }: { select: { allocation: unknown } }) => [{ id: "don_abc123", status: "CAPTURED", amount: dec(25), currency: "EUR", paypalCaptureId: "CAP1", createdAt: new Date("2026-11-02T10:00:00Z"), allocation: pick(rows[0], select.allocation) }]),
    },
  } as never;
}

const PRIVATE = /PRIVATE-/;

describe("donor plans", () => {
  it("keeps family details out of the list, the plan and contributions", async () => {
    expect(JSON.stringify(await listPlans(db()))).not.toMatch(PRIVATE);
    expect(JSON.stringify(await getPlan(db(), "alloc_abcdef123456"))).not.toMatch(PRIVATE);
    expect(JSON.stringify(await listContributions(db(), "donor_1"))).not.toMatch(PRIVATE);
  });

  it("works out funding from captured donations only", async () => {
    const [plan] = await listPlans(db());
    expect(plan).toMatchObject({ title: "Food and medicine support", urgency: "high", can_fund: true, funding: { goal: 100, captured: 25, remaining: 75, percent: 25, donations: 1 } });
  });

  it("shows the part of the approved amount the items do not cover", async () => {
    const plan = await getPlan(db(), "alloc_abcdef123456");
    expect(plan.items).toHaveLength(1);
    expect(plan.not_itemised).toBe(60);
  });

  it("closes funding when the goal is met or the plan is not approved", async () => {
    const [funded] = await listPlans(db([row({ donations: [{ amount: dec(100), updatedAt: new Date() }] })]));
    expect(funded!.can_fund).toBe(false);
    const [paid] = await listPlans(db([row({ status: "DISBURSED" })]));
    expect(paid!.can_fund).toBe(false);
  });

  it("answers NOT_FOUND for a plan that isn't visible", async () => {
    await expect(getPlan(db([]), "nope")).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("marks only recorded steps as complete", () => {
    const steps = planSteps(row() as never, 0);
    expect(steps.filter((step) => step.state === "complete").map((step) => step.key)).toEqual(["approved"]);
    expect(steps.find((step) => step.key === "funding")).toMatchObject({ state: "not_recorded" });
  });

  it("does not treat a captured donation as a supplier payment", () => {
    const steps = planSteps(row() as never, 100);
    expect(steps.find((step) => step.key === "funding")?.state).toBe("complete");
    expect(steps.find((step) => step.key === "supplier_payment")?.state).toBe("not_recorded");
  });

  it("labels a simulated supplier payment", () => {
    const step = planSteps(row({ payouts: [{ status: "COMPLETED", mode: "SIMULATED", createdAt: new Date() }] }) as never, 0).find((item) => item.key === "supplier_payment");
    expect(step).toMatchObject({ state: "complete", simulated: true });
  });

  it("reports a recorded delivery problem without its note", () => {
    const events = [{ status: "ISSUE_REPORTED", createdAt: new Date(), note: "PRIVATE-NOTE" }];
    const steps = planSteps(row({ purchaseOrder: { createdAt: new Date(), merchant: { name: "Shop" }, events } }) as never, 0);
    expect(steps.at(-1)).toMatchObject({ key: "issue_reported", state: "issue" });
    expect(JSON.stringify(steps)).not.toMatch(PRIVATE);
  });
});

describe("NGO records", () => {
  it("keeps real and simulated supplier payments apart in the totals", async () => {
    const group = (rows: unknown[]) => vi.fn(async () => rows);
    const ledger = await getLedger({
      donation: { groupBy: group([{ currency: "EUR", _sum: { amount: dec(50) } }]), findMany: vi.fn(async () => []) },
      aidAllocation: { groupBy: group([{ currency: "EUR", _sum: { amount: dec(300) } }]) },
      payout: { groupBy: group([{ currency: "EUR", mode: "SIMULATED", _sum: { amount: dec(20) } }, { currency: "EUR", mode: "SANDBOX", _sum: { amount: dec(10) } }]), findMany: vi.fn(async () => []) },
    } as never);
    expect(ledger.totals).toEqual([{ currency: "EUR", captured: 50, allocated: 300, paid: 10, simulated: 20, balance: 40 }]);
  });

  it("never copies a case's saved assessment into the audit view", async () => {
    const records = await getAuditRecords({
      auditLog: { findMany: vi.fn(async () => [{ id: "log_1", action: "case.orchestrated", entityType: "AssistanceRequest", entityId: "case_12345678-aaaa", actorId: null, actor: null, createdAt: new Date(), details: { situation: { summary: "PRIVATE-SUMMARY" }, reason: "PRIVATE-REASON", amount: "PRIVATE-AMOUNT" } }]) },
      supplierIncident: { findMany: vi.fn(async () => []) },
      merchant: { findMany: vi.fn(async () => []) },
    } as never);
    expect(records.entries[0]).toMatchObject({ title: "Case recorded", actor: "System", subject: "LL-12345678", note: null });
    expect(JSON.stringify(records)).not.toMatch(PRIVATE);
  });

  it.each(["/api/records/ledger", "/api/records/audit"])("%s is NGO only", async (path) => {
    const donor = createApp({ resolveSession: async () => ({ id: "donor", email: "donor@example.test", role: "DONOR" }) });
    expect((await request(donor).get(path)).status).toBe(403);
    expect((await request(createApp()).get(path)).status).toBe(401);
  });

  it("does not let community partners read donor plans", async () => {
    const partner = createApp({ resolveSession: async () => ({ id: "partner", email: "partner@example.test", role: "PARTNER" }) });
    expect((await request(partner).get("/api/plans")).status).toBe(403);
  });
});
