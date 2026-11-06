# PayPal Sandbox integration

See `docs/paypal-integration.md`. All PayPal calls happen here, on the backend, only after approval checks.
Credentials never reach the browser.

| File          | Owner     | What it does                                                        |
| ------------- | --------- | ------------------------------------------------------------------- |
| `client.ts`   | shared (main) | OAuth token cache + `paypal.paypalFetch(path, { body })`. Don't edit in a feature branch. |
| `orders.ts`   | Member 3  | Create and capture donor orders                                     |
| `webhooks.ts` | Member 2  | Signature verification, idempotent processing                       |
| `payouts.ts`  | Member 2  | Sandbox payout if Payouts is enabled, otherwise a labelled simulation |

```ts
import { paypal } from "./client";

const order = await paypal.paypalFetch<{ id: string }>("/v2/checkout/orders", { body: { intent: "CAPTURE", ... } });
```
