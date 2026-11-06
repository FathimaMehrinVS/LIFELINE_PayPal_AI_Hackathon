import { z } from "zod";

const EnvSchema = z.object({
  PORT: z.coerce.number().int().positive().default(4000),
  WEB_ORIGIN: z.string().default("http://localhost:3000"),
  DATABASE_URL: z.string().optional(),
  GROQ_API_KEY: z.string().optional(),
  GROQ_MODEL: z.string().optional(),
  PAYPAL_CLIENT_ID: z.string().optional(),
  PAYPAL_CLIENT_SECRET: z.string().optional(),
  PAYPAL_BASE_URL: z.string().default("https://api-m.sandbox.paypal.com"),
});

export const env = EnvSchema.parse(process.env);
