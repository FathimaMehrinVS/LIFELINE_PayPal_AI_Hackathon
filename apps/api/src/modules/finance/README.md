# Financial Intelligence — Member 2 (`feature/financial-intelligence`)

Agents: **Financial Route**, **Accessibility**, **Cost & Anomaly**, **Risk & Compliance**.

Input `FinanceRequest` → output `FinanceResult` (`packages/contracts/src/finance.ts`):
per-route fee, usable value, accessibility score with factor breakdown, risk flags, verdict, recommendation.

- Scores, fees and verdicts are deterministic code in `src/rules/`. The LLM only writes `explanation`.
- Never recommend a route with verdict `block`, an `unsupported` route, or one whose required access is `unavailable`.
- Replace the `notImplemented` handler in `src/routes/finance.routes.ts`.
- Frontend: `apps/web/app/finance/`. Tests: `tests/finance/`.
