import { readFileSync } from "node:fs";
import { join } from "node:path";
import { type CaseResult, CaseResultSchema, type SituationResult } from "@lifeline/contracts";
import { describe, expect, it } from "vitest";
import { createMemoryCaseStore } from "../../apps/api/src/orchestration/case-store";
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
