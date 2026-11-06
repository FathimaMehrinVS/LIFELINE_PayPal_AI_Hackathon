# Financial Intelligence — Member 2 (`feature/financial-intelligence`)

Agents: **Financial Route**, **Accessibility**, **Cost & Anomaly**, **Risk & Compliance**.

Input `FinanceRequest` → output `FinanceResult` (`packages/contracts/src/finance.ts`):
per-route fee, usable value, accessibility score with factor breakdown, risk flags, verdict, recommendation.

- Scores, fees and verdicts are deterministic code in `src/rules/`. The LLM only writes `explanation`.
- Never recommend a route with verdict `block`, an `unsupported` route, or one whose required access is `unavailable`.
- Replace the `notImplemented` handler in `src/routes/finance.routes.ts`.
- Frontend: `apps/web/app/finance/`. Tests: `tests/finance/`.

## Case persistence

The finance endpoint has no case/request ID, so it returns an assessment without writing a database row. The
Orchestrator should save the result after it has an existing `AssistanceRequest.id`:

```ts
import { evaluateRoutes } from "../modules/finance/finance.service";
import { saveFinancialAssessment } from "../modules/finance/finance.persistence";

const finance = await evaluateRoutes(financeRequest);
await saveFinancialAssessment(assistanceRequest.id, finance);
```

`saveFinancialAssessment()` upserts the `FinancialAssessment` row by `requestId`, stores all route assessments as
JSON, and records the score version. The `AssistanceRequest` must exist first because the schema enforces a foreign
key. Repeated evaluation for the same request updates its assessment instead of creating a duplicate.
