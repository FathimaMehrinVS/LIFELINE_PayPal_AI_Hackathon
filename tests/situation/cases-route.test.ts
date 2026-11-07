import type { AddressInfo } from "node:net";
import type { CaseResult } from "@lifeline/contracts";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

// The route with the real in-memory store and a fake Orchestrator (no network, no database).
const runCase = vi.fn();
vi.mock("../../apps/api/src/orchestration/run-case", () => ({ runCase: (...args: unknown[]) => runCase(...args) }));

const { createApp } = await import("../../apps/api/src/app");

const caseFor = (id: string, status: CaseResult["status"]): CaseResult =>
  ({ case_id: id, status, situation: {}, finance: null, commerce: null, missing_information: [] }) as unknown as CaseResult;

let base = "";
let server: ReturnType<ReturnType<typeof createApp>["listen"]>;
beforeAll(async () => {
  server = createApp().listen(0);
  await new Promise((r) => server.once("listening", r));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
afterAll(() => server.close());
beforeEach(() => runCase.mockReset());

const post = (query = "") =>
  fetch(`${base}/api/cases${query}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message: "test" }),
  });

describe("POST /api/cases?replaces=", () => {
  it("re-runs a case that needs information under the same id", async () => {
    runCase.mockImplementation(async (id: string) => caseFor(id, "needs_information"));
    const first = (await (await post()).json()) as CaseResult;

    runCase.mockImplementation(async (id: string) => caseFor(id, "complete"));
    const res = await post(`?replaces=${first.case_id}`);

    expect(res.status).toBe(200);
    expect(((await res.json()) as CaseResult).case_id).toBe(first.case_id);
  });

  it("won't change a complete case", async () => {
    runCase.mockImplementation(async (id: string) => caseFor(id, "complete"));
    const done = (await (await post()).json()) as CaseResult;

    expect((await post(`?replaces=${done.case_id}`)).status).toBe(400);
  });

  it("answers 404 for an unknown case", async () => {
    expect((await post("?replaces=case_00000000-0000-0000-0000-000000000000")).status).toBe(404);
    expect((await post("?replaces=not-a-case")).status).toBe(404);
  });
});
