import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { SituationResult } from "@lifeline/contracts";
import { describe, expect, it, vi } from "vitest";
import type { JsonRequest, LlmClient } from "../../apps/api/src/ai/llm-client";
import { analyzeSituation } from "../../apps/api/src/modules/situation/situation.service";
import { SITUATION_SYSTEM_PROMPT } from "../../apps/api/src/modules/situation/prompts";

const sample = (file: string) =>
  JSON.parse(readFileSync(join(import.meta.dirname, "../../packages/contracts/samples", file), "utf8"));

/** Fake LLM: returns a fixed reply and records what it was asked. No network. */
function fakeLlm(reply: SituationResult) {
  const generateJson = vi.fn(async <T>(_request: JsonRequest<T>) => reply as T);
  return { client: { generateJson } as LlmClient, generateJson };
}

describe("analyzeSituation", () => {
  it("sends the prompt and the request to the LLM in one call", async () => {
    const input = sample("situation-request.json");
    const { client, generateJson } = fakeLlm(sample("situation-result.json"));

    await analyzeSituation(input, client);

    expect(generateJson).toHaveBeenCalledOnce();
    const request = generateJson.mock.calls[0]![0];
    expect(request.system).toBe(SITUATION_SYSTEM_PROMPT);
    expect(JSON.parse(request.user)).toEqual(input);
    expect(request.temperature).toBe(0);
  });

  it("applies the checks to the LLM reply", async () => {
    const reply: SituationResult = { ...sample("situation-result.json"), missing_information: [] };
    const { client } = fakeLlm(reply);

    const result = await analyzeSituation({ message: "...", location: "Kerala" }, client);

    expect(result.location).toBe("Kerala");
    expect(result.missing_information).toContain("wallet_acceptance");
  });

  it("passes LLM failures on to the caller", async () => {
    const client: LlmClient = {
      generateJson: async () => {
        throw new Error("rate limited");
      },
    };
    await expect(analyzeSituation({ message: "help" }, client)).rejects.toThrow("rate limited");
  });
});
