import { env } from "../../config/env";
import { HttpError } from "../../utils/http-error";

// Shared by Member 2 (webhooks.ts, payouts.ts) and Member 3 (orders.ts). Changes go through a small PR to main.

export interface PaypalConfig {
  baseUrl: string;
  clientId?: string;
  clientSecret?: string;
}

export interface PaypalClient {
  /** Calls the PayPal REST API with a cached OAuth token. Throws UPSTREAM_ERROR on a non-2xx reply. */
  paypalFetch<T>(path: string, init?: { method?: string; body?: unknown; headers?: Record<string, string> }): Promise<T>;
}

/** Refresh the token a minute before PayPal says it expires. */
const EXPIRY_MARGIN_MS = 60_000;

export function createPaypalClient(config: PaypalConfig, fetchImpl: typeof fetch = fetch): PaypalClient {
  let token: { value: string; expiresAt: number } | undefined;

  async function accessToken(): Promise<string> {
    if (token && Date.now() < token.expiresAt) return token.value;
    if (!config.clientId || !config.clientSecret) {
      throw new HttpError("UPSTREAM_ERROR", "PayPal is not configured: set PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET in .env");
    }

    const res = await fetchImpl(`${config.baseUrl}/v1/oauth2/token`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${config.clientId}:${config.clientSecret}`).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: "grant_type=client_credentials",
      signal: AbortSignal.timeout(30_000),
    });
    if (!res.ok) throw new HttpError("UPSTREAM_ERROR", `PayPal OAuth returned HTTP ${res.status}`);

    const body = (await res.json()) as { access_token: string; expires_in: number };
    token = { value: body.access_token, expiresAt: Date.now() + body.expires_in * 1000 - EXPIRY_MARGIN_MS };
    return token.value;
  }

  return {
    async paypalFetch<T>(path: string, init: { method?: string; body?: unknown; headers?: Record<string, string> } = {}) {
      const res = await fetchImpl(`${config.baseUrl}${path}`, {
        method: init.method ?? (init.body === undefined ? "GET" : "POST"),
        headers: {
          Authorization: `Bearer ${await accessToken()}`,
          "Content-Type": "application/json",
          ...init.headers,
        },
        body: init.body === undefined ? undefined : JSON.stringify(init.body),
        signal: AbortSignal.timeout(30_000),
      });

      const text = await res.text();
      const json: unknown = text ? JSON.parse(text) : {};
      if (!res.ok) {
        // PayPal error bodies carry name, message and debug_id, which help when asking PayPal for support.
        throw new HttpError("UPSTREAM_ERROR", `PayPal ${path} returned HTTP ${res.status}`, json);
      }
      return json as T;
    },
  };
}

/** Shared client, configured from .env (sandbox by default). */
export const paypal = createPaypalClient({
  baseUrl: env.PAYPAL_BASE_URL,
  clientId: env.PAYPAL_CLIENT_ID,
  clientSecret: env.PAYPAL_CLIENT_SECRET,
});
