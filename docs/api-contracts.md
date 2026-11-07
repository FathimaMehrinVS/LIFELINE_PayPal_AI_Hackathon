# API contracts

Source of truth: `packages/contracts/src/`. Complete example payloads: `packages/contracts/samples/`
(tested against the schemas). To change a contract, tell the team, open a small PR to `main`, and update the
samples in the same PR.

Base URL: `http://localhost:4000`

## Shared values

| Name           | Values                                                                               |
| -------------- | ------------------------------------------------------------------------------------ |
| `currency`     | 3-letter ISO 4217 code, e.g. `EUR`                                                   |
| amounts        | numbers in major units, at most 2 decimals                                           |
| amount label   | `estimate` · `confirmed` · `illustrative`                                             |
| `urgency`      | `low` · `medium` · `high` · `critical`                                               |
| need category  | `food` · `water` · `medicine` · `shelter` · `hygiene` · `baby_supplies` · `clothing` · `transport` · `other` |
| availability   | `available` · `limited` · `unavailable` · `unknown`                                  |
| access factors | `bank_availability` · `atm_access` · `wallet_acceptance` · `cash_availability` · `merchant_acceptance` · `connectivity` |

## Errors (all endpoints)

```json
{ "error": { "code": "VALIDATION_ERROR", "message": "Request body does not match the contract", "details": [] } }
```

| Code               | HTTP |
| ------------------ | ---- |
| `VALIDATION_ERROR` | 400  |
| `NOT_FOUND`        | 404  |
| `INTERNAL_ERROR`   | 500  |
| `NOT_IMPLEMENTED`  | 501  |
| `UPSTREAM_ERROR`   | 502  |

## Endpoints

| Method | Path                                  | Request                | Response           | Owner    |
| ------ | ------------------------------------- | ---------------------- | ------------------ | -------- |
| GET    | `/health`                             | —                      | `{status:"ok"}`    | Shared   |
| POST   | `/api/situation/analyze`              | `SituationRequest`     | `SituationResult`  | Member 1 |
| POST   | `/api/finance/evaluate`               | `FinanceRequest`       | `FinanceResult`    | Member 2 |
| POST   | `/api/commerce/basket`                | `CommerceRequest`      | `CommerceResult`   | Member 3 |
| POST   | `/api/payments/donations`             | `CreateDonationRequest`| `DonationResult`   | Member 3 |
| POST   | `/api/payments/donations/:id/capture` | —                      | `DonationResult`   | Member 3 |
| POST   | `/api/payments/payouts`               | `CreatePayoutRequest`  | `PayoutResult`     | Member 2 |
| POST   | `/api/payments/webhooks/paypal`       | Verified PayPal event  | `200`              | Member 3 |
| POST   | `/api/cases`                          | `SituationRequest`     | `CaseResult`       | Member 1 |
| GET    | `/api/cases`                          | —                      | `CaseResult[]`     | Member 1 |
| POST   | `/api/allocations/approve`            | `ApproveAllocationRequest` | `AllocationResult` | Member 2 |

## Situation (Member 1)

Request: `{ message, location?, currency? }` → see `samples/situation-request.json`.

Response highlights (`samples/situation-result.json`):

```json
{
  "summary": "Parents in a conflict-affected area need food and medicine. ...",
  "needs": ["food", "medicine"],
  "budget": 300,
  "currency": "EUR",
  "location": null,
  "urgency": "high",
  "access": { "bank_availability": "unavailable", "connectivity": "limited", "wallet_acceptance": "unknown", "...": "..." },
  "missing_information": ["location", "wallet_acceptance", "local_merchant_availability"],
  "confidence": 0.84
}
```

## Financial (Member 2)

Request: `{ amount, currency, access, routes[] }`. Each route has fees, `fee_label`, the access factors it
`requires` and its `eligibility` (`verified` · `unverified` · `unsupported`). See `samples/finance-request.json`.

Response: `recommended_route_id` (or `null`), and per route: `estimated_fee`, `usable_value`, `accessibility`
(score, version, factor breakdown), `verdict` (`pass` · `review` · `block`) and `flags`. See
`samples/finance-result.json`.

## Commerce (Member 3)

Request: `{ needs[], budget, currency, location, reserve_ratio? }` (default reserve 20%). See
`samples/commerce-request.json`.

The handler persists an AssistanceRequest, Basket, selected BasketItems and their Merchant/Product catalogue rows.
Response is `CommerceResult`: `items[]` and `alternatives[]` (each with `source` `channel3` · `local_registry`,
availability and `price_label`), `total`, `reserve`, `unmet_needs`, `explanation`. See
`samples/commerce-request.json` and `samples/commerce-result.json`. A 20% reserve is the default; all money
selection and arithmetic is deterministic. Local registry prices are illustrative.

The one-call Commerce Ranking Agent returns product IDs and short reasons. It does not set prices, quantities,
totals, reserve, or payment state. If the LLM or Channel3 is unavailable, deterministic ranking and the local
synthetic registry are used.

## Cases (Member 1)

`POST /api/cases` takes a `SituationRequest` and runs Situation → Finance → Commerce.

```json
{
  "case_id": "...",
  "status": "complete",
  "situation": { "...": "SituationResult" },
  "finance": { "...": "FinanceResult, or null if the case stopped earlier" },
  "commerce": { "...": "CommerceResult, or null if the case stopped earlier" },
  "missing_information": ["location"]
}
```

`status`: `complete` · `needs_information` (budget or currency missing; stops after Situation) ·
`no_usable_route` (no route passed; stops after Finance).

## Allocations (Member 2)

- Approve: `{ case_id, campaign_id, amount, currency }` → `{ allocation_id, case_id, status, amount, currency, approved_at }`
- Allocation status: `proposed` · `approved` · `rejected` · `disbursed`
- Approval records the NGO decision for an eligible case; captured donation funding is checked before any future
  payout, not at approval time.

## Payments (donations: Member 3, payouts: Member 2)

- Donation: `{ allocation_id, amount, currency }` → `{ donation_id, allocation_id, paypal_order_id, status, amount, currency, approval_url? }`; creation requires an approved allocation, an active matching campaign, and an amount no greater than the allocation.
- Capture: no request body → `{ donation_id, allocation_id?, paypal_order_id, paypal_capture_id?, status, amount, currency }`; `paypal_capture_id` is present after PayPal confirms a completed capture. The return page does not infer success from the redirect.
- Donation status: `created` · `approved` · `captured` · `failed` · `cancelled` · `refunded`
- Payout/disbursement: `{ allocation_id, amount, currency }` → `{ payout_id, allocation_id, status, amount, currency, mode, notice?, paypal_batch_id? }`.
  The current path returns `mode: simulated`, an explicit no-transfer notice, and records an internal demo state only;
  it does not call PayPal or claim recipient delivery. It requires captured campaign donations to cover the allocation.
