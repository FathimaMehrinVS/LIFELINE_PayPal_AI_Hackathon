import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { createLlmClient } from "../../apps/api/src/ai/llm-client";
import type { ProviderConfig } from "../../apps/api/src/ai/providers";

const groq: ProviderConfig = { name: "groq", baseUrl: "https://groq.test", apiKey: "k1", model: "m1" };
const gemini: ProviderConfig = { name: "gemini", baseUrl: "https://gemini.test", apiKey: "k2", model: "m2" };
const schema = z.object({ urgency: z.enum(["low", "high"]) });
const request = { system: "test", user: "test", schema };

function reply(content: string, status = 200) {
  return new Response(JSON.stringify({ choices: [{ message: { content } }] }), { status });
}

describe("llm client", () => {
  it("returns the validated JSON from the primary provider", async () => {
    const fetchMock = vi.fn().mockResolvedValue(reply('{"urgency":"high"}'));
    const result = await createLlmClient([groq, gemini], fetchMock).generateJson(request);
    expect(result).toEqual({ urgency: "high" });
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(fetchMock.mock.calls[0]?.[0]).toBe("https://groq.test/chat/completions");
  });

  it("falls back to the next provider on a rate limit", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response("{}", { status: 429 }))
      .mockResolvedValueOnce(reply('{"urgency":"low"}'));
    const result = await createLlmClient([groq, gemini], fetchMock).generateJson(request);
    expect(result).toEqual({ urgency: "low" });
    expect(fetchMock.mock.calls[1]?.[0]).toBe("https://gemini.test/chat/completions");
  });

  it("rejects replies that do not match the schema", async () => {
    const fetchMock = vi.fn().mockResolvedValue(reply('{"urgency":"extreme"}'));
    await expect(createLlmClient([groq], fetchMock).generateJson(request)).rejects.toMatchObject({
      code: "UPSTREAM_ERROR",
    });
  });

  it("does not retry on an authentication error", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response("{}", { status: 401 }));
    await expect(createLlmClient([groq, gemini], fetchMock).generateJson(request)).rejects.toMatchObject({
      code: "UPSTREAM_ERROR",
    });
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it("explains when no provider is configured", async () => {
    await expect(createLlmClient([]).generateJson(request)).rejects.toThrow(/GROQ_API_KEY/);
  });
});
