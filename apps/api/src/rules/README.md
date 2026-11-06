# Deterministic decision engine

Plain TypeScript, no LLM. Everything here must give the same output for the same input and be unit-tested.

| File (to be added)       | Owner    | What it decides                                                |
| ------------------------ | -------- | -------------------------------------------------------------- |
| `accessibility-score.ts` | Member 2 | 0–100 score from the access factors, with versioned weights   |
| `fees.ts`                | Member 2 | Fee, usable value, fee-anomaly flags against a reference range |
| `route-eligibility.ts`   | Member 2 | pass / review / block per route                                |
| `basket.ts`              | Member 3 | Totals, reserve, whether a basket fits the budget              |
| `approval.ts`            | Shared   | Whether a payment or payout may run (NGO approval, limits)     |

Rules from the proposal:

- The accessibility score explains; it never denies aid or lowers priority.
- A fee flag is a request for review, not proof of fraud.
- Unknown access data is never treated as available.
- Use `utils/money.ts` for all money arithmetic.
