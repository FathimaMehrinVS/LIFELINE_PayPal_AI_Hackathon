import { type SituationRequest, type SituationResult, SituationResultSchema } from "@lifeline/contracts";
import type { LlmClient } from "../../ai/llm-client";
import { applySituationChecks } from "../../rules/situation-checks";
import { SITUATION_SYSTEM_PROMPT } from "./prompts";

/**
 * Situation Agent: one LLM call turns the message into a draft SituationResult,
 * then the deterministic checks make sure nothing unknown is hidden.
 * The client is passed in so tests can use a fake one without network.
 */
export async function analyzeSituation(input: SituationRequest, llm: LlmClient): Promise<SituationResult> {
  // The NGO's amount is a decision, not something the message said, so the AI never sees it.
  const { assistance_amount: _ngoAmount, ...report } = input;
  const raw = await llm.generateJson({
    system: SITUATION_SYSTEM_PROMPT,
    user: JSON.stringify(report),
    schema: SituationResultSchema,
    // Extraction, not writing: keep the output as repeatable as possible.
    temperature: 0,
  });
  return applySituationChecks(raw, input);
}
