# Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│ apps/web (Next.js + Tailwind)                                    │
│ /situation   /finance   /commerce   /dashboard (AG Grid)         │
└───────────────────────────────┬──────────────────────────────────┘
                                │ JSON, shapes from packages/contracts
┌───────────────────────────────▼──────────────────────────────────┐
│ apps/api (Express)                                               │
│                                                                  │
│ routes/ ── validate against contract ──► modules/                │
│                                          ├ situation/  Member 1  │
│                                          ├ finance/    Member 2  │
│                                          └ commerce/   Member 3  │
│                                                                  │
│ ai/llm-client ◄── modules call the LLM only through this         │
│ rules/        ◄── scores, fees, totals, approval (no AI)         │
│ orchestration/ ── chains the modules at integration time         │
└───────┬──────────────┬───────────────┬──────────────┬────────────┘
        │              │               │              │
   Groq / Gemini   Channel3      PayPal Sandbox    Supabase
                                                  (Prisma)
```

## Request flow

```
message
  └─► Situation Intelligence ─► SituationResult
                                  needs, budget, access factors, unknowns
        └─► Financial Intelligence ─► FinanceResult
                                        recommended route, usable value
              └─► Commerce Intelligence ─► CommerceResult
                                             basket within usable value, reserve
                    └─► NGO / donor approval ─► rules/approval
                          └─► PayPal Sandbox ─► webhooks ─► ledger ─► dashboard
```

During development each module is called on its own endpoint with sample JSON from
`packages/contracts/samples/`. `orchestration/` chains them after the three branches are merged.

## Agents

The nine agents from the proposal are logical steps inside the three modules, not nine model calls.
See [ai-design.md](ai-design.md).

| Module    | Agents                                                      | Owner    |
| --------- | ----------------------------------------------------------- | -------- |
| Situation | Situation Agent, Orchestrator                               | Member 1 |
| Financial | Financial Route, Accessibility, Cost & Anomaly, Risk & Compliance | Member 2 |
| Commerce  | Commerce Agent, Decision Agent, PayPal Agent                | Member 3 |
| (code)    | Deterministic Decision Engine: `apps/api/src/rules/`        | Shared   |

## Where things live

| Concern                 | Location                                     |
| ----------------------- | -------------------------------------------- |
| Request/response shapes | `packages/contracts/src/`                    |
| Sample payloads         | `packages/contracts/samples/`                |
| LLM calls               | `apps/api/src/ai/llm-client.ts`              |
| Scores, fees, totals    | `apps/api/src/rules/`, `utils/money.ts`      |
| Input validation        | `apps/api/src/middleware/validate.ts`        |
| Error format            | `middleware/error-handler.ts`, `ApiError`    |
| Environment variables   | `apps/api/src/config/env.ts`, `.env.example` |
| Database                | `prisma/schema.prisma`, `database/prisma.ts` |
| External APIs           | `apps/api/src/integrations/`                 |

## Rules

- A route validates input, calls its module and returns the contract's result.
- Modules never import each other. Chaining happens in `orchestration/`.
- Throw `HttpError` for expected failures; anything else becomes `INTERNAL_ERROR`.
- Money is a number in major units with at most 2 decimals, stored as `Decimal(12, 2)`.
- Payment calls happen only on the backend, after approval checks.
