import { describe, expect, it, vi } from "vitest";
import { createPaypalClient } from "../../apps/api/src/integrations/paypal/client";

const config = { baseUrl: "https://paypal.test", clientId: "id", clientSecret: "secret" };
const tokenReply = () => new Response(JSON.stringify({ access_token: "tok", expires_in: 3600 }), { status: 200 });

describe("paypal client", () => {
  it("gets a token once and reuses it", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(tokenReply())
      .mockImplementation(async () => new Response(JSON.stringify({ id: "ORDER-1" }), { status: 201 }));
    const client = createPaypalClient(config, fetchMock);

    await client.paypalFetch("/v2/checkout/orders", { body: { intent: "CAPTURE" } });
    const result = await client.paypalFetch<{ id: string }>("/v2/checkout/orders/ORDER-1");

    expect(result).toEqual({ id: "ORDER-1" });
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock.mock.calls[0]?.[0]).toBe("https://paypal.test/v1/oauth2/token");
    expect(fetchMock.mock.calls[1]?.[1]).toMatchObject({ method: "POST", headers: { Authorization: "Bearer tok" } });
    expect(fetchMock.mock.calls[2]?.[1]).toMatchObject({ method: "GET" });
  });

  it("throws UPSTREAM_ERROR with PayPal's error body on a failed call", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(tokenReply())
      .mockResolvedValueOnce(new Response(JSON.stringify({ name: "INVALID_REQUEST", debug_id: "abc" }), { status: 400 }));

    await expect(createPaypalClient(config, fetchMock).paypalFetch("/v2/checkout/orders", { body: {} })).rejects.toMatchObject({
      code: "UPSTREAM_ERROR",
      details: { name: "INVALID_REQUEST", debug_id: "abc" },
    });
  });

  it("explains missing credentials without calling PayPal", async () => {
    const fetchMock = vi.fn();
    await expect(createPaypalClient({ baseUrl: "https://paypal.test" }, fetchMock).paypalFetch("/x")).rejects.toMatchObject({
      code: "UPSTREAM_ERROR",
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
