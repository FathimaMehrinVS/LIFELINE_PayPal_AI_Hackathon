import { z } from "zod";

const optional = z.string().optional().transform((v) => (v === "" ? undefined : v));

const EnvSchema = z.object({
  PORT: z.coerce.number().int().positive().default(4000),
  WEB_ORIGIN: z.string().default("http://localhost:3000"),
  DATABASE_URL: optional,
  SUPABASE_URL: optional,
  SUPABASE_ANON_KEY: optional,

  LLM_PROVIDER: z.enum(["groq", "gemini"]).default("groq"),
  GROQ_API_KEY: optional,
  GROQ_MODEL: optional,
  GEMINI_API_KEY: optional,
  GEMINI_MODEL: optional,

  CHANNEL3_API_KEY: optional,

  PAYPAL_CLIENT_ID: optional,
  PAYPAL_CLIENT_SECRET: optional,
  PAYPAL_BASE_URL: z.string().default("https://api-m.sandbox.paypal.com"),
  PAYPAL_WEBHOOK_ID: optional,
});

export const env = EnvSchema.parse(process.env);
