# PayPal integrations

Member 3 donor checkout uses the PayPal Sandbox Orders API through the shared `client.ts` OAuth client. See
[`docs/paypal-integration.md`](../../../../../docs/paypal-integration.md) for setup and the complete create → approve
→ capture procedure.

| File | Owner | Responsibility |
| --- | --- | --- |
| `client.ts` | Shared | OAuth token cache and authenticated `paypal.paypalFetch(...)`; do not redesign in a feature branch. |
| `orders.ts` | Member 3 | Sandbox-only CAPTURE order creation and order capture. |
| `webhooks.ts` | Member 2 | Webhook work, when present on the integrated branch. |
| `payouts.ts` | Member 2 | Payout work, when present on the integrated branch. |

Required Member 3 server variables are `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`, and
`PAYPAL_BASE_URL=https://api-m.sandbox.paypal.com`. The Orders integration rejects a non-Sandbox host. Never
place PayPal credentials in frontend code.
