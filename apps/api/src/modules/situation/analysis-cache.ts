import { createHash } from "node:crypto";
import type { SituationRequest, SituationResult } from "@lifeline/contracts";
import type { LlmClient } from "../../ai/llm-client";
import { TtlCache } from "../../utils/ttl-cache";
import { analyzeSituation } from "./situation.service";

// Owner: Member 1. The same report is often read twice: on Continue and again on Submit, or on a retry. Reusing the
// result for 15 minutes saves AI calls and the shared rate limit. Only successful, validated results are kept.

const results = new TtlCache<string, SituationResult>(15 * 60_000, 300);

const keyFor = (input: SituationRequest) =>
  createHash("sha256").update(JSON.stringify([input.message, input.location ?? null, input.currency ?? null, input.assistance_amount ?? null])).digest("hex");

export async function analyzeSituationCached(input: SituationRequest, llm: LlmClient): Promise<SituationResult> {
  const key = keyFor(input);
  const known = results.get(key);
  if (known) return structuredClone(known);
  const result = await analyzeSituation(input, llm);
  results.set(key, structuredClone(result));
  return result;
}
