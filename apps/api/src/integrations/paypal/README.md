# PayPal integrations

Member 3 donation checkout and donation webhooks use the PayPal Sandbox APIs through the shared `client.ts` OAuth client. See
[`docs/paypal-integration.md`](../../../../../docs/paypal-integration.md) for setup and the complete create → approve
→ capture procedure and webhook behavior.

| File | Owner | Responsibility |
| --- | --- | --- |
| `client.ts` | Shared | OAuth token cache and authenticated PayPal requests, including exact-body requests for webhook verification. |
| `orders.ts` | Member 3 | Sandbox-only CAPTURE order creation and order capture. |
| `webhooks.ts` | Member 3 | Sandbox signature verification and idempotent donation event handling; Member 2 can extend this for payout events. |
| `payouts.ts` | Member 2 | No real PayPal payout integration is present. Assistance disbursement is simulated in `modules/finance/disbursement.service.ts`; it does not call PayPal. |

Required server variables are `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`, and
`PAYPAL_BASE_URL=https://api-m.sandbox.paypal.com`. The Orders and webhook integrations reject a non-Sandbox host.
`PAYPAL_WEBHOOK_ID` is required when the webhook endpoint is used and is added after registering the Sandbox
webhook following deployment. Never place PayPal credentials or the webhook ID in frontend code.
