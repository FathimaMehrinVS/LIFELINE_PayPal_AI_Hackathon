import type { AddressInfo } from "node:net";
import type { CaseResult } from "@lifeline/contracts";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { caseStore } from "../../apps/api/src/orchestration/case-store";

// The route with the real in-memory store and a fake Orchestrator (no network, no database).
const runCase = vi.fn();
const saveSpy = vi.spyOn(caseStore, "save");
vi.mock("../../apps/api/src/orchestration/run-case", () => ({ runCase: (...args: unknown[]) => runCase(...args) }));

const { createApp } = await import("../../apps/api/src/app");

const caseFor = (id: string, status: CaseResult["status"]): CaseResult =>
  ({ case_id: id, status, situation: {}, finance: null, commerce: null, missing_information: [] }) as unknown as CaseResult;

let base = "";
let server: ReturnType<ReturnType<typeof createApp>["listen"]>;
let activeSession: { id: string; email: string; role: "NGO" | "DONOR" | "PARTNER" } = { id: "test-user", email: "test@example.test", role: "NGO" };
beforeAll(async () => {
  server = createApp({ resolveSession: async () => activeSession }).listen(0);
  await new Promise((r) => server.once("listening", r));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
afterAll(() => server.close());
beforeEach(() => {
  runCase.mockReset();
  saveSpy.mockClear();
  activeSession = { id: "test-user", email: "test@example.test", role: "NGO" };
});

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
    expect(saveSpy).toHaveBeenCalledWith(expect.objectContaining({ case_id: first.case_id }), expect.any(Object), "test-user", "test-user");

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

  it("keeps owned requests private and prevents an NGO from re-running another user's case", async () => {
    activeSession = { id: "request-owner", email: "owner@example.test", role: "DONOR" };
    runCase.mockImplementation(async (id: string) => caseFor(id, "needs_information"));
    const createdResponse = await post();
    expect(createdResponse.status).toBe(201);
    const created = await createdResponse.json() as CaseResult;

    const ownerList = await fetch(`${base}/api/cases/mine`).then((response) => response.json()) as CaseResult[];
    expect(ownerList.map((item) => item.case_id)).toContain(created.case_id);

    activeSession = { id: "different-user", email: "reviewer@example.test", role: "NGO" };
    const otherUserList = await fetch(`${base}/api/cases/mine`).then((response) => response.json()) as CaseResult[];
    expect(otherUserList.map((item) => item.case_id)).not.toContain(created.case_id);

    const denied = await post(`?replaces=${created.case_id}`);
    expect(denied.status).toBe(404);

    activeSession = { id: "request-owner", email: "owner@example.test", role: "DONOR" };
    runCase.mockImplementation(async (id: string) => caseFor(id, "complete"));
    const ownerUpdate = await post(`?replaces=${created.case_id}`);
    expect(ownerUpdate.status).toBe(200);
  });
});
