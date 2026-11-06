import "dotenv/config";
import { defineConfig } from "prisma/config";

// The CLI (migrate, studio) uses the direct connection; the API uses the pooled DATABASE_URL at runtime.
// Supabase: DIRECT_URL = session connection (port 5432), DATABASE_URL = transaction pooler (port 6543).
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: { path: "prisma/migrations" },
  datasource: { url: process.env.DIRECT_URL ?? process.env.DATABASE_URL ?? "" },
});
