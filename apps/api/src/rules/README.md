# Deterministic decision engine

Deterministic TypeScript rules. Basket arithmetic is code; the commerce LLM can influence candidate ranking and
item reasons but never controls prices, quantities, totals, budget fit or reserve. Rules should give the same
output for the same inputs and be unit-tested.

| File | Owner | What it decides |
| --- | --- | --- |
| `accessibility-score.ts` | Member 2 | 0–100 score from the access factors, with versioned weights |
| `fees.ts` | Member 2 | Fee, usable value, fee-anomaly flags against a reference range |
| `route-eligibility.ts` | Member 2 | pass / review / block per route |
| `basket.ts` | Member 3 | Integer-cent product selection, totals, reserve, alternatives and unmet needs |
| `approval.ts` | Shared | Whether a payment or payout may run (NGO approval, limits) |

Rules from the proposal:

- The accessibility score explains; it never denies aid or lowers priority.
- A fee flag is a request for review, not proof of fraud.
- Unknown access data is never treated as available.
- Use `utils/money.ts` for all money arithmetic.
