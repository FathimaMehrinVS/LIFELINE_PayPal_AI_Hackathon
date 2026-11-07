# Member 3: Commerce Intelligence and donor checkout

**Branch:** `feature/commerce-payments`

## As-built implementation

- Basket endpoint: `POST /api/commerce/basket`, validated by `CommerceRequestSchema` and returning `CommerceResult`.
- Donation endpoints: `POST /api/payments/donations` and `POST /api/payments/donations/:id/capture`.
- Local source: 25 synthetic products across food, water, medicine, hygiene, baby supplies, clothing, shelter and
  household essentials, across four explicitly synthetic merchant labels. Database merchant rows are unverified.
- Product sources: `ProductSource`, `LocalRegistrySource`, `Channel3Source`, combined by `CompositeProductSource`.
  Channel3 is optional; missing credentials and upstream errors leave the local registry usable.
- Ranking: one structured request to the shared LLM client, with deterministic fallback. The model ranks product
  IDs and supplies reasons; rules own selected quantities, prices, totals, budget, reserve and unmet needs.
- Persistence: Basket/BasketItem and related Product/Merchant records use the existing Prisma schema. Donations
  store amount, currency, status, PayPal order ID and confirmed capture ID.
- Frontend: `/commerce`, `/donate` and `/donate/return`.

PayPal must remain on `https://api-m.sandbox.paypal.com`. The backend shares the OAuth client; the browser only
receives the approval URL. Successful completion is shown only after the capture endpoint confirms PayPal's
completed capture. The Sandbox/manual payment and live database flow still need verification before calling the
branch demo-ready.

## Clone and run

Requires Node.js 22 or later, npm, a Supabase PostgreSQL project, and a PayPal Developer Sandbox REST app.

```bash
git clone https://github.com/FathimaMehrinVS/LIFELINE_PayPal_AI_Hackathon.git
cd LIFELINE_PayPal_AI_Hackathon
git checkout feature/commerce-payments
npm install
cp .env.example .env
```

Edit `.env` locally. From Supabase **Connect**, put the transaction pooler URL in `DATABASE_URL` and session/direct
URL in `DIRECT_URL`. Create a REST app in the PayPal **Sandbox** dashboard and set its Sandbox client ID and
secret, leaving `PAYPAL_BASE_URL=https://api-m.sandbox.paypal.com`. Create a Sandbox Personal buyer account for
approval testing. Set `WEB_ORIGIN=http://localhost:3000` and `NEXT_PUBLIC_API_URL=http://localhost:4000` for local
development. Configure `GROQ_API_KEY` and `GROQ_MODEL`, or Gemini equivalents, for ranking; `CHANNEL3_API_KEY` is
optional. Never commit `.env`.

```bash
npm run db:migrate
npm run db:seed
npm run dev:api
```

In a second terminal:

```bash
npm run dev:web
```

The seed creates the demo campaign `camp_demo` with currency EUR. `npm run dev` can start API and web together.

## PayPal Sandbox manual test

1. Open a complete assistance case in the NGO dashboard and approve it. Approval records the NGO decision; it does
   not claim funds have been transferred.
2. From that case, open the approved allocation's donation link, enter an amount up to the allocation amount, and
   submit. In the browser Network panel, verify `POST /api/payments/donations` returns HTTP 201 with the allocation
   ID, donation ID, PayPal order ID, `created` status, amount, currency and `approval_url`.
3. Verify the donation row exists in Supabase with that `paypalOrderId` and `CREATED` status. The order is also
   visible in Sandbox activity.
4. The browser opens PayPal Sandbox. Sign in using the Sandbox Personal buyer account, review and approve.
5. PayPal redirects to `/donate/return?donation_id=...`; the page sends
   `POST /api/payments/donations/:id/capture` to LIFELINE.
6. Wait for the backend response. Verify the response contains `status: "captured"` and `paypal_capture_id`, and
   the page shows success only after that response.
7. In the database, verify the Donation row has the expected `allocationId`, `status = CAPTURED`, the same PayPal
   order ID, and a non-null `paypalCaptureId`.
8. Negative case: start another donation and cancel on PayPal. The app returns to `/donate?state=cancelled`; it
   must not show capture success. Verify that donation is not `CAPTURED`.

## PayPal Sandbox webhooks

`POST /api/payments/webhooks/paypal` verifies the untouched request body with PayPal's Sandbox verification API
before recording or applying donation events. It handles `CHECKOUT.ORDER.APPROVED`,
`PAYMENT.CAPTURE.COMPLETED`, and `PAYMENT.CAPTURE.DENIED`; verified event IDs are deduplicated through
`WebhookEvent`.

Register the webhook on the deployed Sandbox REST app and set `PAYPAL_WEBHOOK_ID` in the API environment after
registration. The handler intentionally fails closed before the ID is configured. Then deliver real Sandbox events
and verify event records and Donation status/capture ID changes in the database.

## Basket manual test

1. Open `http://localhost:3000/commerce`.
2. Select food, water and hygiene, enter location `Demo location` and budget `100` EUR, then build the basket.
3. Verify each returned item has a product, synthetic merchant, quantity, unit price, source and subtotal. Local
   registry prices must say illustrative.
4. Verify the total equals the selected subtotals and is no more than budget minus the reserve target. For the
   default 20% target, a €100 budget allows up to €80 in selected products.
5. Verify reserve, explanation, unmet needs, and any listed alternatives. AI reasons do not control displayed
   prices or arithmetic.
6. In Supabase Studio, inspect AssistanceRequest, Basket, BasketItem, Product and Merchant rows. Confirm selected
   quantities/subtotals and the Basket total/reserve match the API response; demo merchants must remain unverified.
7. Over-budget case: request food, water and hygiene with a €5 budget. Verify total is at most €4 (20% reserve
   target where feasible), reserve is not negative, and uncovered needs appear in `unmet_needs`.

## Channel3 manual check

With `CHANNEL3_API_KEY` configured, build a basket and inspect returned items for any `source: "channel3"` entries.
The source accepts only parseable products in the requested currency with a usable price and need category. Search
results may be empty for a query or key; the API then continues with local synthetic products. To test fallback,
clear the key or temporarily make Channel3 unavailable and submit the same basket request; basket construction
should still return using local products without crashing.

## Automated verification

```bash
npm test
npm run typecheck
```

Tests mock PayPal, Channel3, LLM and database route dependencies. They do not verify real Sandbox account setup or
live PostgreSQL connectivity.
