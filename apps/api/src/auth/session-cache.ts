import { createHash } from "node:crypto";
import { TtlCache } from "../utils/ttl-cache";
import type { AuthSession } from "./session";

// Owner: Member 1. Checking a sign-in costs a call to Supabase and a database read on every request. A verified
// session is remembered for 30 seconds, keyed by a hash of the token (the token itself is never stored).
// Access changes clear it at once, so a new role applies immediately.

const sessions = new TtlCache<string, AuthSession>(30_000, 2_000);

const keyFor = (authorization: string) => createHash("sha256").update(authorization).digest("hex");

export function cacheSessions(resolve: (authorization: string | undefined) => Promise<AuthSession>) {
  return async (authorization: string | undefined): Promise<AuthSession> => {
    if (!authorization) return resolve(authorization);
    const key = keyFor(authorization);
    const known = sessions.get(key);
    if (known) return known;
    const session = await resolve(authorization);
    sessions.set(key, session);
    return session;
  };
}

/** Call after any role change, so nobody keeps old access for the rest of the 30 seconds. */
export function clearSessionCache(): void {
  sessions.clear();
}
