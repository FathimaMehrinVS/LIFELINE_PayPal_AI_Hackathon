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
| POST   | `/api/payments/payouts`               | `CreatePayoutRequest`  | `PayoutResult`     | Member 3 |
| POST   | `/api/payments/webhooks/paypal`       | PayPal event           | `200`              | Member 3 |

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

Response: `items[]` and `alternatives[]` (each with `source` `channel3` · `local_registry`, availability and
`price_label`), `total`, `reserve`, `unmet_needs`, `explanation`. See `samples/commerce-result.json`.

## Payments (Member 3)

- Donation: `{ campaign_id, amount, currency }` → `{ donation_id, paypal_order_id, status, amount, currency, approval_url? }`
- Donation status: `created` · `approved` · `captured` · `failed` · `cancelled` · `refunded`
- Payout: `{ allocation_id, amount, currency }` → `{ payout_id, allocation_id, status, amount, currency, mode, paypal_batch_id? }`
- Payout `mode`: `sandbox` (real PayPal Sandbox) or `simulated` (demo fallback, must be labelled in the UI)
