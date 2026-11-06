import type { ZodType } from "zod";
import { HttpError } from "../utils/http-error";
import { type ProviderConfig, providersFromEnv } from "./providers";

export interface JsonRequest<T> {
  /** Instructions: role, rules, and the exact JSON shape expected. */
  system: string;
  /** The data to work on (user message, sample JSON, ...). */
  user: string;
  /** Contract schema the reply must satisfy. The reply is untrusted until it passes. */
  schema: ZodType<T>;
  temperature?: number;
}

export interface LlmClient {
  generateJson<T>(request: JsonRequest<T>): Promise<T>;
}

/** Errors worth retrying on the next provider: rate limits, timeouts, provider outages. */
function isRetryable(status: number) {
  return status === 408 || status === 429 || status >= 500;
}

class ProviderError extends Error {
  constructor(
    readonly provider: string,
    readonly retryable: boolean,
    message: string,
  ) {
    super(message);
  }
}

async function callProvider(provider: ProviderConfig, request: JsonRequest<unknown>, fetchImpl: typeof fetch) {
  const res = await fetchImpl(`${provider.baseUrl}/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${provider.apiKey}` },
    body: JSON.stringify({
      model: provider.model,
      temperature: request.temperature ?? 0.2,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: `${request.system}\n\nRespond with a single JSON object only.` },
        { role: "user", content: request.user },
      ],
    }),
    signal: AbortSignal.timeout(30_000),
  });

  if (!res.ok) {
    throw new ProviderError(provider.name, isRetryable(res.status), `${provider.name} returned HTTP ${res.status}`);
  }

  const body = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  const content = body.choices?.[0]?.message?.content;
  if (!content) throw new ProviderError(provider.name, true, `${provider.name} returned an empty reply`);

  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    throw new ProviderError(provider.name, true, `${provider.name} returned invalid JSON`);
  }

  const result = request.schema.safeParse(parsed);
  if (!result.success) {
    throw new ProviderError(provider.name, true, `${provider.name} reply does not match the schema`);
  }
  return result.data;
}

export function createLlmClient(providers: ProviderConfig[], fetchImpl: typeof fetch = fetch): LlmClient {
  return {
    async generateJson<T>(request: JsonRequest<T>): Promise<T> {
      if (providers.length === 0) {
        throw new HttpError("UPSTREAM_ERROR", "No LLM provider configured: set GROQ_API_KEY and GROQ_MODEL in .env");
      }

      const failures: string[] = [];
      for (const provider of providers) {
        try {
          return (await callProvider(provider, request, fetchImpl)) as T;
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          failures.push(message);
          const retryable = err instanceof ProviderError ? err.retryable : true;
          if (!retryable) break;
        }
      }
      throw new HttpError("UPSTREAM_ERROR", "LLM request failed", failures);
    },
  };
}

/** Shared client for all modules: Groq first, Gemini as fallback (see LLM_PROVIDER). */
export const llm = createLlmClient(providersFromEnv());
