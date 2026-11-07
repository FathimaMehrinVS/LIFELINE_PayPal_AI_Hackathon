# PayPal Sandbox donor checkout

Member 3's donation flow uses PayPal Sandbox only. `PAYPAL_BASE_URL` must be exactly
`https://api-m.sandbox.paypal.com`; the Orders integration rejects other hosts. Client credentials stay on the API
server and are never sent to the browser.

## Configuration

Set these server-side in the ignored `.env` file:

```env
PAYPAL_CLIENT_ID=
PAYPAL_CLIENT_SECRET=
PAYPAL_BASE_URL=https://api-m.sandbox.paypal.com
PAYPAL_WEBHOOK_ID=
WEB_ORIGIN=http://localhost:3000
DATABASE_URL=
```

Create a REST app under the **Sandbox** tab in the PayPal Developer Dashboard. Use its Sandbox client ID and
secret. Create a Sandbox Personal buyer account for approval. Register the Sandbox webhook after deployment and
then set its webhook ID in the server-side `PAYPAL_WEBHOOK_ID` variable. The handler fails closed until this value
is configured; it is intentionally left blank in `.env.example` and is not needed for order creation or capture.

## Create, approve, capture

```text
Browser                         LIFELINE API / database             PayPal Sandbox
   |                                      |                                |
   | POST /api/payments/donations         |                                |
   |------------------------------------->| OAuth via shared client        |
   |                                      | POST /v2/checkout/orders       |
   |                                      |------------------------------->|
   |                                      | order ID + approval URL         |
   |                                      |<-------------------------------|
   | 201 Donation (CREATED) + URL         |                                |
   |<-------------------------------------|                                |
   | redirect donor to approval URL                                        |
   |---------------------------------------------------------------------->|
   |                 Sandbox buyer approves                                |
   |<----------------------------------------------------------------------|
   | /donate/return?donation_id=...                                         |
   | POST /api/payments/donations/:id/capture                               |
   |------------------------------------->| POST order capture             |
   |                                      |------------------------------->|
   |                                      | completed capture + ID         |
   |                                      |<-------------------------------|
   |                                      | save capture ID/status          |
   |                                      | status = CAPTURED                |
   | captured response                   |                                |
   |<-------------------------------------|                                |
```

The API uses the shared `paypal.paypalFetch(...)` client for cached OAuth and authenticated REST requests.
`POST /api/payments/donations` requires an approved assistance allocation, validates its active campaign and
currency, and limits the amount to the approved allocation. It creates a CAPTURE order, then stores the Donation as
`CREATED` with both the allocation ID and PayPal order ID. The response includes `allocation_id`, `donation_id`,
`paypal_order_id`, `status`, `amount`, `currency`, and `approval_url`.

The return page calls `POST /api/payments/donations/:id/capture`. The API only records `CAPTURED` and
`paypalCaptureId` after PayPal reports a completed capture with a matching order, amount and currency. A repeated
capture returns the already captured donation. An incomplete or mismatched capture is an error and does not set
the captured state. Reaching the return URL alone never signals success.

The cancel URL returns to `/donate?state=cancelled`; this displays cancellation without changing the Donation to
`CAPTURED`.

## PayPal Sandbox webhooks

`POST /api/payments/webhooks/paypal` preserves the original JSON bytes, then calls PayPal's Sandbox
`/v1/notifications/verify-webhook-signature` endpoint through the shared OAuth client. No event is processed unless
PayPal returns `verification_status: SUCCESS`. Verified event IDs are recorded in `WebhookEvent` and processed in
the same transaction so retries do not repeat donation transitions.

The donation handler supports `CHECKOUT.ORDER.APPROVED` (`CREATED` → `APPROVED`),
`PAYMENT.CAPTURE.COMPLETED` (`CREATED`/`APPROVED` → `CAPTURED` after order, capture ID, amount and currency
validation), and `PAYMENT.CAPTURE.DENIED` (`CREATED`/`APPROVED` → `FAILED`). Registration and live webhook delivery
verification are deployment steps and have not been completed locally.

## API endpoints

- `POST /api/payments/donations` — body `{ "allocation_id": "<approved allocation ID>", "amount": 25, "currency": "EUR" }`.
- `POST /api/payments/donations/:id/capture` — no body; returns the Donation status and, after capture,
  `paypal_capture_id`.

Request and response schemas live in `packages/contracts/src/payment.ts`. The demo seed creates campaign
`camp_demo` in EUR. The NGO dashboard supplies the allocation ID after approval; opening `/donate` without that
target does not start checkout.

## Local run

After configuring Supabase and Sandbox values in `.env` and seeding the database:

```bash
npm run dev:api
npm run dev:web
```

Open `http://localhost:3000/donate`, submit a donation, approve it using the Sandbox Personal buyer, and verify
the backend-confirmed result and database row. Do not use Live credentials or Live endpoints for the hackathon.
