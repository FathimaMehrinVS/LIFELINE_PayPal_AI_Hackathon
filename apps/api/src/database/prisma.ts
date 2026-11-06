import { PrismaPg } from "@prisma/adapter-pg";
import { env } from "../config/env";
import { PrismaClient } from "../generated/prisma/client";
import { HttpError } from "../utils/http-error";

let client: PrismaClient | undefined;

/** Shared Prisma client. Created on first use so the API still starts without a database configured. */
export function getPrisma(): PrismaClient {
  if (!env.DATABASE_URL) {
    throw new HttpError("INTERNAL_ERROR", "DATABASE_URL is not set");
  }
  client ??= new PrismaClient({ adapter: new PrismaPg({ connectionString: env.DATABASE_URL }) });
  return client;
}
