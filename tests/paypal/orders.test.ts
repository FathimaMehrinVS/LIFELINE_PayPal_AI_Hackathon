import { describe, expect, it, vi } from "vitest";
import type { PaypalClient } from "../../apps/api/src/integrations/paypal/client";
import { captureDonationOrder, createDonationOrder } from "../../apps/api/src/integrations/paypal/orders";

describe("PayPal Orders integration", () => {
  it("creates a CAPTURE order and returns its approval URL", async () => {
    const paypalFetch = vi.fn().mockResolvedValue({ id: "ORDER-1", status: "CREATED", links: [{ rel: "approve", href: "https://sandbox.test/approve" }] });
    const result = await createDonationOrder({ donationId: "don-1", amount: 12.5, currency: "EUR", returnUrl: "https://site.test/return", cancelUrl: "https://site.test/cancel" }, { paypalFetch } as unknown as PaypalClient);
    expect(result).toEqual({ orderId: "ORDER-1", approvalUrl: "https://sandbox.test/approve" });
    expect(paypalFetch).toHaveBeenCalledWith("/v2/checkout/orders", expect.objectContaining({ body: expect.objectContaining({ intent: "CAPTURE", purchase_units: [{ reference_id: "don-1", custom_id: "don-1", amount: { currency_code: "EUR", value: "12.50" } }] }) }));
  });

  it("captures and returns only completed capture details", async () => {
    const paypalFetch = vi.fn().mockResolvedValue({ id: "ORDER-1", status: "COMPLETED", purchase_units: [{ payments: { captures: [{ id: "CAP-1", status: "COMPLETED", amount: { value: "12.50", currency_code: "EUR" } }] } }] });
    await expect(captureDonationOrder("ORDER-1", { paypalFetch } as unknown as PaypalClient)).resolves.toEqual({ orderId: "ORDER-1", status: "COMPLETED", captureId: "CAP-1", amount: { value: "12.50", currency_code: "EUR" } });
    expect(paypalFetch.mock.calls[0]?.[0]).toBe("/v2/checkout/orders/ORDER-1/capture");
  });

  it("preserves shared-client upstream failures", async () => {
    const paypalFetch = vi.fn().mockRejectedValue(Object.assign(new Error("PayPal failed"), { code: "UPSTREAM_ERROR" }));
    await expect(createDonationOrder({ donationId: "don-2", amount: 1, currency: "EUR", returnUrl: "https://site.test/r", cancelUrl: "https://site.test/c" }, { paypalFetch } as unknown as PaypalClient)).rejects.toMatchObject({ code: "UPSTREAM_ERROR" });
  });
});
