# Architecture

```
            ┌─────────────────────────┐
            │   apps/web  (Next.js)   │
            └────────────┬────────────┘
                         │ HTTP (JSON, shapes from packages/contracts)
            ┌────────────▼────────────┐
            │   apps/api  (Express)   │
            │                         │
            │  routes/  → validate    │
            │  modules/ → logic       │
            │  orchestration/         │
            └──┬──────────┬────────┬──┘
               │          │        │
        integrations/  integrations/  Prisma
           groq         paypal      (PostgreSQL)
```

## Request flow

```
message ──► Situation Agent ──► SituationResult
                                  │ needs, budget, currency, location
                                  ▼
                       Financial Intelligence ──► FinanceResult (recommended route, fee)
                                  │
                                  ▼
                       Commerce Intelligence ──► CommerceResult (basket within budget − fee)
                                  │
                                  ▼
                          Payment (PayPal) ──► PaymentResult
```

During development each module is called on its own endpoint. `orchestration/` chains them once the
three feature branches are merged.

## Where things live

| Concern                       | Location                              |
| ----------------------------- | ------------------------------------- |
| Request/response shapes       | `packages/contracts/src/`             |
| Input validation              | `apps/api/src/middleware/validate.ts` |
| Error format                  | `apps/api/src/middleware/error-handler.ts`, `ApiError` contract |
| Environment variables         | `apps/api/src/config/env.ts`, `.env.example` |
| Module logic                  | `apps/api/src/modules/<module>/`      |
| External APIs                 | `apps/api/src/integrations/<service>/`|
| Database schema               | `prisma/schema.prisma`                |

## Rules

- A route validates input against its contract, calls its module, and returns the contract's result.
- Modules never call each other directly. Chaining happens in `orchestration/`.
- Throw `HttpError` for expected failures. Anything else becomes `INTERNAL_ERROR`.
- Money is a number in major units with at most 2 decimals, stored as `Decimal(12, 2)`.
