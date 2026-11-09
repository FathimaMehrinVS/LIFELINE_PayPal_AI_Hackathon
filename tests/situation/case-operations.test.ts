import type { CaseResult } from "@lifeline/contracts";
import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import { createApp } from "../../apps/api/src/app";
import { attachOperations, getCaseTimeline, getRecentActivity } from "../../apps/api/src/orchestration/case-operations";

const amount = (value: number) => ({ toNumber: () => value, toFixed: (places: number) => value.toFixed(places) });
const item = (id: string) => ({ case_id: id }) as CaseResult;
const at = (minute: number) => new Date(`2026-11-09T10:0${minute}:00Z`);

const allocation = {
  id: "alloc_1", requestId: "case_a", status: "APPROVED", amount: amount(100), currency: "EUR", approvedAt: at(2),
  donations: [{ amount: amount(10.1) }, { amount: amount(20.2) }],
  payouts: [],
};

describe("attachOperations", () => {
  const db = (rows: unknown[]) => ({ aidAllocation: { findMany: vi.fn(async () => rows) } }) as never;

  it("reports the approval and only captured donations", async () => {
    const [result] = await attachOperations(db([allocation]), [item("case_a")]);
    expect(result!.operations).toMatchObject({ allocation: { allocation_id: "alloc_1", status: "approved", amount: 100 }, funding: { captured: 30.3, donations: 2 }, payout: null, delivery: null });
  });

  it("shows nothing for a case with no records", async () => {
    const [result] = await attachOperations(db([]), [item("case_b")]);
    expect(result!.operations).toEqual({ allocation: null, funding: { captured: 0, donations: 0 }, payout: null, delivery: null });
  });

  it("keeps a donation and a supplier payment as separate facts", async () => {
    const paid = { ...allocation, payouts: [{ id: "p1", allocationId: "alloc_1", status: "COMPLETED", amount: amount(30), currency: "EUR", mode: "SIMULATED" }] };
    const [withPayout] = await attachOperations(db([paid]), [item("case_a")]);
    const [withoutPayout] = await attachOperations(db([allocation]), [item("case_a")]);
    expect(withPayout!.operations?.payout).toMatchObject({ mode: "simulated", status: "completed" });
    expect(withoutPayout!.operations?.funding.captured).toBe(30.3);
    expect(withoutPayout!.operations?.payout).toBeNull();
  });
});

describe("getCaseTimeline", () => {
  const db = (saves: unknown[], record: unknown) => ({ auditLog: { findMany: vi.fn(async () => saves) }, aidAllocation: { findUnique: vi.fn(async () => record) } }) as never;

  it("lists recorded steps oldest first", async () => {
    const record = {
      amount: amount(100), currency: "EUR", approvedAt: at(2),
      donations: [{ status: "CAPTURED", amount: amount(25), currency: "EUR", createdAt: at(3), updatedAt: at(4) }],
      payouts: [{ mode: "SIMULATED", amount: amount(25), currency: "EUR", createdAt: at(5) }],
    };
    const timeline = await getCaseTimeline(db([{ createdAt: at(0) }, { createdAt: at(1) }], record), "case_a");
    expect(timeline.map((entry) => entry.title)).toEqual(["Request recorded", "Details added and checked again", "Approved by NGO", "Donation captured", "Simulated disbursement recorded"]);
    expect(timeline[4]!.detail).toBe("No money was transferred");
  });

  it("doesn't claim a capture for a donation that only started", async () => {
    const record = { amount: amount(100), currency: "EUR", approvedAt: at(2), donations: [{ status: "CREATED", amount: amount(25), currency: "EUR", createdAt: at(3), updatedAt: at(3) }], payouts: [] };
    const titles = (await getCaseTimeline(db([{ createdAt: at(0) }], record), "case_a")).map((entry) => entry.title);
    expect(titles).toContain("Donation started");
    expect(titles).not.toContain("Donation captured");
  });

  it("adds no money steps before approval", async () => {
    expect(await getCaseTimeline(db([{ createdAt: at(0) }], null), "case_a")).toHaveLength(1);
  });

  it("answers 404 for an unknown case", async () => {
    await expect(getCaseTimeline(db([], null), "case_x")).rejects.toThrow("not found");
  });

  it.each(["DONOR", "PARTNER"] as const)("is closed to %s accounts", async (role) => {
    const app = createApp({ resolveSession: async () => ({ id: "x", email: "x@example.test", role }) });
    expect((await request(app).get("/api/cases/case_a/timeline")).status).toBe(403);
  });
});

describe("getRecentActivity", () => {
  it("describes recorded events in plain words, without personal details", async () => {
    const findMany = vi.fn(async () => [
      { action: "supplier.status_changed", entityId: "sup_1", details: { to: "suspended", reason: "secret note" }, createdAt: at(2) },
      { action: "case.orchestrated", entityId: "case_abcdef12-0000", details: { situation: { summary: "private" } }, createdAt: at(1) },
    ]);
    const activity = await getRecentActivity({ auditLog: { findMany } } as never);
    expect(activity.map((entry) => entry.title)).toEqual(["Supplier suspended", "Case recorded"]);
    expect(activity[1]!.detail).toBe("LL-ABCDEF12");
    expect(JSON.stringify(activity)).not.toMatch(/secret|private/);
  });

  it.each(["DONOR", "PARTNER"] as const)("is closed to %s accounts", async (role) => {
    const app = createApp({ resolveSession: async () => ({ id: "x", email: "x@example.test", role }) });
    expect((await request(app).get("/api/cases/activity")).status).toBe(403);
  });
});
