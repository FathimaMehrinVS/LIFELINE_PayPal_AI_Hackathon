import { readFileSync } from "node:fs";
import { join } from "node:path";
import { type CaseResult, CaseResultSchema, type SituationResult } from "@lifeline/contracts";
import { describe, expect, it } from "vitest";
import type { PrismaClient } from "../../apps/api/src/generated/prisma/client";
import {
  CASE_AUDIT_ACTION,
  createMemoryCaseStore,
  createPrismaCaseStore,
} from "../../apps/api/src/orchestration/case-store";
import { sampleCases } from "../../apps/api/src/orchestration/sample-cases";

describe("sample cases", () => {
  it.each(sampleCases().map((c) => [c.case_id, c] as const))("%s matches the CaseResult contract", (_id, sample) => {
    expect(CaseResultSchema.safeParse(sample).error?.issues ?? []).toEqual([]);
  });
});

const situation: SituationResult = JSON.parse(
  readFileSync(join(import.meta.dirname, "../../packages/contracts/samples/situation-result.json"), "utf8"),
);
const makeCase = (id: string): CaseResult => ({
  case_id: id,
  status: "needs_information",
  situation,
  finance: null,
  commerce: null,
  missing_information: ["location"],
});

describe("memory case store", () => {
  it("lists newest first", async () => {
    const store = createMemoryCaseStore();
    await store.save(makeCase("a"));
    await store.save(makeCase("b"));
    expect((await store.list()).map((c) => c.case_id)).toEqual(["b", "a"]);
  });

  it("returns only requests owned by the authenticated profile", async () => {
    const store = createMemoryCaseStore();
    await store.save(makeCase("owned-a"), undefined, "profile-a");
    await store.save(makeCase("owned-b"), undefined, "profile-b");

    expect((await store.listByOwner("profile-a")).map((item) => item.case_id)).toEqual(["owned-a"]);
    expect(await store.ownerOf("owned-b")).toBe("profile-b");
  });

  it("replaces a case saved again and moves it to the top", async () => {
    const store = createMemoryCaseStore();
    await store.save(makeCase("a"));
    await store.save(makeCase("b"));
    await store.save({ ...makeCase("a"), status: "complete" });
    const list = await store.list();
    expect(list.map((c) => c.case_id)).toEqual(["a", "b"]);
    expect(list[0]!.status).toBe("complete");
  });

  it("drops the oldest case past the limit", async () => {
    const store = createMemoryCaseStore(2);
    for (const id of ["a", "b", "c"]) await store.save(makeCase(id));
    expect((await store.list()).map((c) => c.case_id)).toEqual(["c", "b"]);
  });
});

/** Records every call; auditLog.findMany returns what was written, newest first. */
function createPrismaStub(options: { failBasket?: boolean } = {}) {
  const calls: Record<string, unknown[]> = {};
  const audit: { entityId: string; details: unknown }[] = [];
  const record = (name: string, result: (args: any) => unknown = () => ({})) => async (args: any) => {
    (calls[name] ??= []).push(args);
    return result(args);
  };
  const prisma = {
    assistanceRequest: {
      findUnique: record("request.findUnique", () => null),
      findMany: record("request.findMany", () => []),
      create: record("request.create"),
      delete: record("request.delete"),
      deleteMany: record("request.deleteMany"),
    },
    financialAssessment: { upsert: record("financial.upsert") },
    basket: {
      create: record("basket.create", () => {
        if (options.failBasket) throw new Error("database down");
        return {};
      }),
    },
    auditLog: {
      create: record("audit.create", (args) => audit.unshift({ entityId: args.data.entityId, details: args.data.details })),
      findMany: record("audit.findMany", () => [...audit]),
    },
  } as unknown as PrismaClient;
  return { prisma, calls };
}

const completeCase = () => sampleCases().find((c) => c.status === "complete")!;

describe("database case store", () => {
  it("saves the request with case_id as its id, so an approval can point at it", async () => {
    const { prisma, calls } = createPrismaStub();
    const sample = completeCase();
    await createPrismaCaseStore(() => prisma).save(sample, { message: "Original message" });

    expect(calls["request.create"]![0]).toMatchObject({
      data: {
        id: sample.case_id,
        message: "Original message",
        status: "AWAITING_APPROVAL",
        situation: { create: { urgency: sample.situation.urgency.toUpperCase(), needs: sample.situation.needs } },
      },
    });
    expect(calls["financial.upsert"]![0]).toMatchObject({ where: { requestId: sample.case_id } });
    expect(calls["basket.create"]![0]).toMatchObject({
      data: { requestId: sample.case_id, total: sample.commerce!.total },
    });
    expect(calls["audit.create"]![0]).toMatchObject({
      data: { action: CASE_AUDIT_ACTION, entityId: sample.case_id },
    });
  });

  it("writes no finance or basket rows for a case that stopped early", async () => {
    const { prisma, calls } = createPrismaStub();
    await createPrismaCaseStore(() => prisma).save(makeCase("stopped"));

    expect(calls["request.create"]![0]).toMatchObject({ data: { id: "stopped", status: "ANALYZED" } });
    expect(calls["financial.upsert"]).toBeUndefined();
    expect(calls["basket.create"]).toBeUndefined();
  });

  it("gives back the same cases, newest first", async () => {
    const { prisma } = createPrismaStub();
    const store = createPrismaCaseStore(() => prisma);
    await store.save(makeCase("a"));
    await store.save(completeCase());

    const list = await store.list();
    expect(list.map((c) => c.case_id)).toEqual([completeCase().case_id, "a"]);
    expect(list[0]).toEqual(completeCase());
  });

  it("replaces the old rows when a case is saved again with the same id", async () => {
    const { prisma, calls } = createPrismaStub();
    const store = createPrismaCaseStore(() => prisma);
    await store.save(makeCase("again"));
    await store.save({ ...makeCase("again"), missing_information: [] });

    expect(calls["request.deleteMany"]).toEqual([{ where: { id: "again" } }, { where: { id: "again" } }]);
    const list = await store.list();
    expect(list.map((c) => c.case_id)).toEqual(["again"]);
    expect(list[0]!.missing_information).toEqual([]);
  });

  it("skips audit rows that no longer match the contract", async () => {
    const { prisma } = createPrismaStub();
    const store = createPrismaCaseStore(() => prisma);
    await store.save(makeCase("good"));
    await (prisma.auditLog.create as any)({ data: { entityId: "old", details: { case_id: "old" } } });

    expect((await store.list()).map((c) => c.case_id)).toEqual(["good"]);
  });

  it("removes the half-saved request when a later step fails", async () => {
    const { prisma, calls } = createPrismaStub({ failBasket: true });
    const sample = completeCase();

    await expect(createPrismaCaseStore(() => prisma).save(sample)).rejects.toThrow("database down");
    expect(calls["request.delete"]![0]).toEqual({ where: { id: sample.case_id } });
    expect(calls["audit.create"]).toBeUndefined();
  });
});
