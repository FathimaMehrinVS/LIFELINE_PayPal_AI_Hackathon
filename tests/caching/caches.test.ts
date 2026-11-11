import { afterEach, describe, expect, it, vi } from "vitest";
import { cacheSessions, clearSessionCache } from "../../apps/api/src/auth/session-cache";
import { TtlCache } from "../../apps/api/src/utils/ttl-cache";

describe("TtlCache", () => {
  afterEach(() => vi.useRealTimers());

  it("returns a value until it expires", () => {
    vi.useFakeTimers();
    const cache = new TtlCache<string, number>(1_000);
    cache.set("a", 1);
    expect(cache.get("a")).toBe(1);
    vi.advanceTimersByTime(1_001);
    expect(cache.get("a")).toBeUndefined();
  });

  it("drops the oldest entry when full", () => {
    const cache = new TtlCache<string, number>(60_000, 2);
    cache.set("a", 1); cache.set("b", 2); cache.set("c", 3);
    expect(cache.get("a")).toBeUndefined();
    expect(cache.get("c")).toBe(3);
  });
});

describe("session cache", () => {
  afterEach(() => clearSessionCache());
  const session = { id: "user-1", email: "u@example.test", role: "NGO" as const };

  it("checks a token once, then reuses the verified session", async () => {
    const resolve = vi.fn(async () => session);
    const cached = cacheSessions(resolve);
    await cached("Bearer token-a");
    await cached("Bearer token-a");
    expect(resolve).toHaveBeenCalledTimes(1);
  });

  it("keeps different tokens apart and never caches a failed check", async () => {
    const resolve = vi.fn(async (authorization: string | undefined) => {
      if (authorization === "Bearer bad") throw new Error("invalid");
      return { ...session, id: authorization ?? "" };
    });
    const cached = cacheSessions(resolve);
    expect((await cached("Bearer one")).id).toBe("Bearer one");
    expect((await cached("Bearer two")).id).toBe("Bearer two");
    await expect(cached("Bearer bad")).rejects.toThrow();
    await expect(cached("Bearer bad")).rejects.toThrow();
    expect(resolve).toHaveBeenCalledTimes(4);
  });

  it("forgets every session after an access change", async () => {
    const resolve = vi.fn(async () => session);
    const cached = cacheSessions(resolve);
    await cached("Bearer token-a");
    clearSessionCache();
    await cached("Bearer token-a");
    expect(resolve).toHaveBeenCalledTimes(2);
  });
});
