# Handoff: Member 3, Commerce Intelligence + PayPal

**Branch:** `feature/commerce-payments`
**Agents you own:** Commerce Agent, Decision Agent, PayPal Agent
**One-line job:** find essential goods and build a basket that fits the family's usable budget with a reserve,
and run the PayPal Sandbox payments (donor checkout, webhooks, payout or labelled fallback).

PayPal is the hackathon's core judging point, so **do PayPal Orders first**, then the basket.

---

## 1. Setup (1 hour, including accounts)

```bash
git clone https://github.com/FathimaMehrinVS/LIFELINE_PayPal_AI_Hackathon.git
cd LIFELINE_PayPal_AI_Hackathon
git checkout feature/commerce-payments
npm install
cp .env.example .env
npm test                     # 17 tests should pass
```

Accounts and keys for `.env`:

- **PayPal:** developer.paypal.com → Apps & Credentials → **Sandbox** → Create App →
  `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`. Also note the sandbox buyer (personal) account for testing.
- **Channel3:** `CHANNEL3_API_KEY`. Check their docs for the search endpoint. Credits are limited, so
  cache responses while developing.
- **Groq:** `GROQ_API_KEY` + `GROQ_MODEL` (console.groq.com)
- **Supabase:** `DATABASE_URL` + `DIRECT_URL` (one teammate creates the project and shares them), then
  `npm run db:migrate`

## 2. Day-one checks (tell the team the results)

- [ ] OAuth token works: `POST {PAYPAL_BASE_URL}/v1/oauth2/token` with basic auth and
  `grant_type=client_credentials`
- [ ] **Is Payouts enabled on the sandbox app?** (App settings → features). This decides the demo:
  real sandbox payout, or a clearly labelled simulated payout.
- [ ] One Channel3 search works and you know the response shape

## 3. What you own

| Path                                        | What goes there                              |
| ------------------------------------------- | -------------------------------------------- |
| `apps/api/src/integrations/paypal/`         | `client.ts`, `orders.ts`, `webhooks.ts`, `payouts.ts` |
| `apps/api/src/integrations/channel3/`       | Channel3 search client                       |
| `apps/api/src/modules/commerce/`            | Product sources, ranking prompt, service     |
| `apps/api/src/rules/basket.ts`              | Totals, reserve, fit check, substitution     |
| `apps/api/src/routes/commerce.routes.ts`, `payment.routes.ts` | Replace `notImplemented` handlers |
| `prisma/seed.ts`                            | Synthetic merchants and products             |
| `apps/web/app/commerce/`                    | Basket + donate pages                        |
| `tests/commerce/`                           | Your tests                                   |

## 4. Your contracts

- **Basket:** `CommerceRequest` → `CommerceResult`, see `packages/contracts/samples/commerce-*.json`
- **Payments:** `CreateDonationRequest` → `DonationResult`, `CreatePayoutRequest` → `PayoutResult`
  (`packages/contracts/src/payment.ts`)
- Full PayPal flow: `docs/paypal-integration.md`

Your basket `budget` is Member 2's `usable_value`. Use the sample (€285) until integration.

## 5. Tasks

### Day 1 (7 Nov): PayPal Orders

- [ ] `integrations/paypal/client.ts`: get and cache the OAuth token (refresh before `expires_in`); one
  `paypalFetch(path, init)` helper that adds the token and throws `HttpError("UPSTREAM_ERROR", ...)` on failure
- [ ] `integrations/paypal/orders.ts`:
  - create: `POST /v2/checkout/orders` with `intent: "CAPTURE"`, amount as a string with 2 decimals
    (`"300.00"`), and a return/cancel URL pointing at the web app. Return the approval link.
  - capture: `POST /v2/checkout/orders/{id}/capture`
- [ ] Routes `POST /api/payments/donations` and `POST /api/payments/donations/:id/capture`; store `Donation`
  rows (`getPrisma()`), status `CREATED` → `CAPTURED`
- [ ] Test it by hand: create → open approval URL → log in with the sandbox buyer → capture

### Day 2 (8 Nov): basket + webhooks

- [ ] Product sources in `modules/commerce/`, behind one interface so they're swappable:

  ```ts
  interface ProductSource {
    search(need: NeedCategory, location: string, currency: string): Promise<BasketItem[]>;
  }
  ```

  - `local-registry.ts`: synthetic verified merchants. Start with an in-memory list; once Supabase is up,
    seed it via `prisma/seed.ts` and search with PostgreSQL full-text search (`$queryRaw` with
    `to_tsvector` / `plainto_tsquery`)
  - `channel3.ts`: Channel3 results mapped to `BasketItem` with `source: "channel3"`, `availability: "unknown"`
    (an online catalogue doesn't prove local availability), `price_label: "estimate"`
- [ ] `rules/basket.ts` (plain code, no AI, use `utils/money.ts`):
  - spendable = `budget × (1 − reserve_ratio)`
  - pick the best-ranked candidate per need; if the total doesn't fit, swap in cheaper candidates
    (keep the swapped-out ones as `alternatives`); if a need still can't fit, add it to `unmet_needs`
  - `reserve = budget − total`, always ≥ 0
- [ ] Commerce Agent: **one** LLM call that ranks all candidates for all needs and writes the explanation.
  The LLM returns product IDs in ranked order; your code builds the basket from them. It never sets prices or totals.
- [ ] Webhooks `POST /api/payments/webhooks/paypal`:
  - verify with `POST /v1/notifications/verify-webhook-signature` (PayPal headers + `PAYPAL_WEBHOOK_ID`)
  - store a `WebhookEvent`; the unique `eventId` means a duplicate event is ignored
  - on `PAYMENT.CAPTURE.COMPLETED`, confirm the donation
  - for local testing, expose port 4000 with a tunnel and register that URL in the sandbox app
- [ ] Unit tests: `rules/basket.ts` with the sample (should give total 221, reserve 64), the over-budget case
  (€350 basket vs €300), and PayPal calls with a mocked `fetch`

### Day 3 (9 Nov): UI + payouts

- [ ] `apps/web/app/commerce/page.tsx`: basket items with source badges (local registry / Channel3),
  availability, price labels, alternatives, reserve, unmet needs, explanation
- [ ] Donate button → `api.createDonation` → redirect to `approval_url` → return page calls
  `api.captureDonation` → shows the status **from the backend**, not from the redirect
- [ ] Payouts: if enabled, `integrations/paypal/payouts.ts` (`POST /v1/payments/payouts`) with
  `mode: "sandbox"`. If not, record `mode: "simulated"` and show **"Demo fallback: simulated payout"** in the UI.
  Only for an `AidAllocation` with status `APPROVED`.
- [ ] Open a PR into `main` by the end of the day.

### Day 4 (10 Nov): integration

- [ ] Merge `main`, help Member 1 plug your basket into the Orchestrator
- [ ] Save `Basket` / `BasketItem` rows
- [ ] Add your requests and tests to the Postman collection (`postman/`)

### Days 5–6 (11–12 Nov): together

Deploy on Render (`render.yaml` is ready; secrets go in the Render dashboard), demo video, submission before
**12:00 PT on 12 Nov**.

## 6. Definition of done

- [ ] Sandbox donation: create → approve → capture, stored in the database
- [ ] Webhook signature verified; a duplicate event doesn't create a duplicate record
- [ ] Sample basket request → total ≤ budget, reserve ≥ 20%, sources and labels set
- [ ] Over-budget case substitutes cheaper items and lists unmet needs
- [ ] Payout runs in sandbox, or is clearly labelled simulated
- [ ] `npm run typecheck` and `npm test` pass

## 7. Rules

- PayPal credentials stay on the backend. Never in `apps/web`.
- A payment is complete only when PayPal confirms it, never because the browser reached a success page.
- Don't call authorisation "escrow" or the internal ledger "PayPal balance".
- The LLM ranks and explains. Prices, totals and the reserve are code.
- Need a new npm package (e.g. a PayPal SDK)? Small PR to `main` first. `fetch` is enough for everything above.

## 8. Who depends on you

| Who      | Needs                                         | When     |
| -------- | --------------------------------------------- | -------- |
| Everyone | Whether Payouts is enabled                     | 7 Nov    |
| Member 1 | `buildBasket()` for the Orchestrator           | 10 Nov   |
| Demo     | Working sandbox checkout                       | 9 Nov    |
