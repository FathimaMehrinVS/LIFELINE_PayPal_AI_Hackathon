# PayPal Sandbox integration — Member 3

See `docs/paypal-integration.md`. All PayPal calls happen here, on the backend, only after approval checks.
Credentials never reach the browser.

Planned files: `client.ts` (OAuth token), `orders.ts` (create/capture donor orders), `webhooks.ts`
(signature verification, idempotent processing), `payouts.ts` (if Payouts is enabled for the account).
