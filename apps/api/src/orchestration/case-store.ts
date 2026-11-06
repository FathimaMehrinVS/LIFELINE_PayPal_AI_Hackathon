import type { CaseResult } from "@lifeline/contracts";

// Owner: Member 1. Where cases are kept for the dashboard.
// In memory for now (lost on restart); a Supabase version with the same interface comes next.

export interface CaseStore {
  save(result: CaseResult): Promise<void>;
  /** Newest first. */
  list(): Promise<CaseResult[]>;
}

/** Keeps the latest cases in memory. Enough for local development and a demo without a database. */
export function createMemoryCaseStore(limit = 200): CaseStore {
  const cases = new Map<string, CaseResult>();
  return {
    async save(result) {
      cases.delete(result.case_id);
      cases.set(result.case_id, result);
      if (cases.size > limit) cases.delete(cases.keys().next().value!);
    },
    async list() {
      return [...cases.values()].reverse();
    },
  };
}

export const caseStore: CaseStore = createMemoryCaseStore();
