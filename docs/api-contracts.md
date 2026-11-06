# API contracts

The source of truth is `packages/contracts/src/`. This page shows the same shapes as examples.
To change a contract, open a small PR to `main` and tell the team first.

Base URL: `http://localhost:4000`

## Errors (all endpoints)

```json
{ "error": { "code": "VALIDATION_ERROR", "message": "Request body does not match the contract", "details": [] } }
```

| Code              | HTTP |
| ----------------- | ---- |
| `VALIDATION_ERROR`| 400  |
| `NOT_FOUND`       | 404  |
| `INTERNAL_ERROR`  | 500  |
| `NOT_IMPLEMENTED` | 501  |
| `UPSTREAM_ERROR`  | 502  |

Shared values:

- `currency`: 3-letter ISO 4217 code, e.g. `"INR"`
- `urgency`: `low` · `medium` · `high` · `critical`
- `needs` / `category`: `food` · `water` · `medicine` · `shelter` · `hygiene` · `clothing` · `transport` · `other`
- Amounts: numbers in major units, at most 2 decimal places

## `GET /health`

```json
{ "status": "ok" }
```

## `POST /api/situation/analyze` — Member 1

Request (`SituationRequest`):

```json
{
  "message": "My family needs food and medicine. I have a budget of 5000 INR.",
  "location": "Kerala",
  "currency": "INR"
}
```

Response (`SituationResult`):

```json
{
  "needs": ["food", "medicine"],
  "budget": 5000,
  "currency": "INR",
  "location": "Kerala",
  "urgency": "high",
  "missing_information": [],
  "confidence": 0.91
}
```

`budget` and `location` are `null` when not stated; add them to `missing_information`.

## `POST /api/finance/evaluate` — Member 2

Request (`FinanceRequest`):

```json
{
  "budget": 5000,
  "currency": "INR",
  "available_routes": [
    {
      "id": "route_a",
      "name": "PayPal",
      "type": "paypal",
      "fee_fixed": 0,
      "fee_percent": 1,
      "estimated_minutes": 5,
      "accessibility_features": ["smartphone", "low_bandwidth"]
    }
  ],
  "accessibility_requirements": ["low_bandwidth"]
}
```

`type`: `paypal` · `bank_transfer` · `mobile_wallet` · `cash_pickup` · `other`

Response (`FinanceResult`):

```json
{
  "recommended_route": "route_a",
  "estimated_fee": 50,
  "accessibility_score": 85,
  "risk_flags": [{ "code": "HIGH_FEE", "severity": "warning", "message": "Fee is above 5% of budget" }],
  "explanation": "PayPal has the lowest fee and works on low bandwidth."
}
```

`severity`: `info` · `warning` · `critical`

## `POST /api/commerce/basket` — Member 3

Request (`CommerceRequest`):

```json
{
  "needs": ["food", "medicine"],
  "budget": 4950,
  "currency": "INR",
  "location": "Kerala"
}
```

Response (`CommerceResult`):

```json
{
  "items": [
    {
      "product_id": "p_rice_5kg",
      "name": "Rice 5 kg",
      "merchant_id": "m_kochi_01",
      "category": "food",
      "quantity": 2,
      "unit_price": 450,
      "subtotal": 900
    }
  ],
  "total": 4200,
  "currency": "INR",
  "remaining_budget": 750
}
```

## `POST /api/payments` — Member 3

Request (`CreatePaymentRequest`):

```json
{ "request_id": "req_123", "route_id": "route_a", "amount": 4200, "currency": "INR" }
```

Response (`PaymentResult`):

```json
{
  "payment_id": "pay_123",
  "provider": "paypal",
  "status": "created",
  "amount": 4200,
  "currency": "INR",
  "approval_url": "https://www.sandbox.paypal.com/checkoutnow?token=..."
}
```

## `POST /api/payments/:id/capture` — Member 3

No body. Returns a `PaymentResult` with `status` `captured` or `failed`.

`status`: `created` · `approved` · `captured` · `failed` · `cancelled`
