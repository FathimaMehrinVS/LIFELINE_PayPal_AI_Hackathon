import type { NextFunction, Request, Response } from "express";
import { HttpError } from "../utils/http-error";

// Owner: Member 1. In-memory limits, enough for one API instance. They stop one person or script from using up the
// shared AI allowance or flooding sign-up. A restart clears them.

type KeyFor = (req: Request, res: Response) => string;

/** The signed-in account where known, otherwise the caller's address. */
export const byAccountOrAddress: KeyFor = (req, res) => {
  const session = res.locals.authSession as { id?: string } | undefined;
  return session?.id ? `user:${session.id}` : `ip:${req.ip ?? "unknown"}`;
};

export function rateLimit(options: { windowMs: number; max: number; name: string; keyFor?: KeyFor }) {
  const hits = new Map<string, { count: number; resetAt: number }>();
  const keyFor = options.keyFor ?? ((req: Request) => `ip:${req.ip ?? "unknown"}`);

  return (req: Request, res: Response, next: NextFunction) => {
    const now = Date.now();
    if (hits.size > 10_000) for (const [key, entry] of hits) if (entry.resetAt <= now) hits.delete(key);
    const key = keyFor(req, res);
    const entry = hits.get(key);
    const current = entry && entry.resetAt > now ? entry : { count: 0, resetAt: now + options.windowMs };
    current.count += 1;
    hits.set(key, current);
    res.setHeader("RateLimit-Limit", String(options.max));
    res.setHeader("RateLimit-Remaining", String(Math.max(options.max - current.count, 0)));
    if (current.count > options.max) {
      res.setHeader("Retry-After", String(Math.ceil((current.resetAt - now) / 1000)));
      return next(new HttpError("RATE_LIMITED", `Too many ${options.name} requests. Please wait a moment and try again.`));
    }
    next();
  };
}

/** Standard protective headers for a JSON API. */
export function securityHeaders(_req: Request, res: Response, next: NextFunction) {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader("Content-Security-Policy", "default-src 'none'; frame-ancestors 'none'");
  if (process.env.NODE_ENV === "production") res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  next();
}
