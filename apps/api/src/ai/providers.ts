import { env } from "../config/env";

export type ProviderName = "groq" | "gemini";

export interface ProviderConfig {
  name: ProviderName;
  /** OpenAI-compatible base URL; requests go to `${baseUrl}/chat/completions`. */
  baseUrl: string;
  apiKey: string;
  model: string;
}

const BASE_URLS: Record<ProviderName, string> = {
  groq: "https://api.groq.com/openai/v1",
  gemini: "https://generativelanguage.googleapis.com/v1beta/openai",
};

function configFor(name: ProviderName): ProviderConfig | undefined {
  const apiKey = name === "groq" ? env.GROQ_API_KEY : env.GEMINI_API_KEY;
  const model = name === "groq" ? env.GROQ_MODEL : env.GEMINI_MODEL;
  if (!apiKey || !model) return undefined;
  return { name, baseUrl: BASE_URLS[name], apiKey, model };
}

/** Primary provider first (LLM_PROVIDER), then the other one as fallback if it is configured. */
export function providersFromEnv(): ProviderConfig[] {
  const order: ProviderName[] = env.LLM_PROVIDER === "groq" ? ["groq", "gemini"] : ["gemini", "groq"];
  return order.map(configFor).filter((p): p is ProviderConfig => p !== undefined);
}
