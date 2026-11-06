# PayPal integration (Sandbox)

| Part                              | Owner    | Code                                                         |
| --------------------------------- | -------- | ------------------------------------------------------------ |
| OAuth token + `paypalFetch`       | shared   | `integrations/paypal/client.ts`                              |
| Donor orders (create, capture)    | Member 3 | `integrations/paypal/orders.ts`, `routes/donation.routes.ts` |
| Webhooks                          | Member 2 | `integrations/paypal/webhooks.ts`, `routes/payout.routes.ts` |
| Allocation approval               | Member 2 | `rules/approval.ts`, `routes/allocation.routes.ts`           |
| Payouts                           | Member 2 | `integrations/paypal/payouts.ts`, `routes/payout.routes.ts`  |

Availability depends on country, account type and product enablement. Verify each capability in the sandbox
before presenting it as implemented.

## Priorities

| Priority | Integration                                                   | Endpoint                                   |
| -------- | ------------------------------------------------------------- | ------------------------------------------ |
| First    | Orders: create and capture donor contributions                | `POST /api/payments/donations`, `POST /api/payments/donations/:id/capture` |
| First    | Webhooks: verify signature, store event, process once         | `POST /api/payments/webhooks/paypal`       |
| Second   | Payouts: check access on day one; real sandbox payout if enabled | `POST /api/payments/payouts`            |
| Third    | Transaction Search for reconciliation                         | (integration phase)                        |

## Donor contribution flow

1. Frontend calls `POST /api/payments/donations`.
2. Backend gets an OAuth token, creates a PayPal order, stores a `Donation` (`CREATED`), returns `approval_url`.
3. Donor approves on PayPal.
4. Frontend calls `POST /api/payments/donations/:id/capture`; backend captures and stores `CAPTURED`.
5. Webhook `PAYMENT.CAPTURE.COMPLETED` arrives; backend verifies the signature with `PAYPAL_WEBHOOK_ID`, stores a
   `WebhookEvent` (unique `eventId` stops duplicates) and confirms the donation.

A payment is never marked complete because the browser reached a success page.

## Approval and payouts

1. The NGO presses **Approve** on the dashboard → `POST /api/allocations/approve`.
2. Backend rule: approve only if `amount ≤ captured donations for the campaign − amount already allocated`. It
   stores an `AidAllocation` (`APPROVED`, approver, time) and an `AuditLog` row.
3. `POST /api/payments/payouts` runs only for an `AidAllocation` with status `APPROVED`. If Payouts is not available for the account, the payout is
recorded with `mode: SIMULATED` and the UI must label it "Demo fallback: simulated payout".

## Must never

- Expose `PAYPAL_CLIENT_SECRET` to the browser.
- Describe authorisation as escrow, or the internal ledger as PayPal-held money.
- Imply a pooled fund or split settlement that the account model doesn't support.
- Help bypass KYC, identity checks or restrictions.

## Setup

1. developer.paypal.com → Apps & Credentials → Sandbox → create an app.
2. Copy client ID and secret into `.env`.
3. Add a webhook pointing at `<API URL>/api/payments/webhooks/paypal`; copy its ID into `PAYPAL_WEBHOOK_ID`.
   For local testing, expose port 4000 with a tunnel.
4. Create sandbox buyer and business accounts for testing.
