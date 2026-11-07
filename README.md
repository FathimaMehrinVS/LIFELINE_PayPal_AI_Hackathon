# LIFELINE

AI-Powered Humanitarian Financial Access and Payment Coordination Network.

> Money should reach people. Access should reach them too.

A person describes a crisis in plain language. LIFELINE works out what they need and what financial access they
actually have, compares the routes for getting money to them, builds a basket of essentials within budget, and
handles the payment through PayPal Sandbox, with human approval before any money moves.

LIFELINE is not a bank, a wallet or a charity platform. It is a decision layer between people in crisis and the
payment infrastructure that still works.

## Three AI modules

| Module                 | AI                         | Also owns                                           | Branch                           | Handoff |
| ---------------------- | -------------------------- | --------------------------------------------------- | -------------------------------- | ------- |
| Situation Intelligence | Situation Agent            | Orchestrator, `/api/cases`, dashboard, Render deploy | `feature/situation-agent`        | [Member 1](docs/handoffs/member-1-situation.md) |
| Financial Intelligence | Explanation Agent          | Fee/score/approval rules, PayPal webhooks + payouts | `feature/financial-intelligence` | [Member 2](docs/handoffs/member-2-financial.md) |
| Commerce Intelligence  | Ranking Agent              | Basket rules, Channel3, PayPal donor checkout       | `feature/commerce-payments`      | [Member 3](docs/handoffs/member-3-commerce.md) |

Each member has about 25 hours of work: one AI part, one set of deterministic rules, one external service, one
frontend page and one final-day job.

AI extracts, compares, ranks and explains. Deterministic code calculates scores, fees and totals. Humans and
backend rules authorise payments.

```
message ─► Situation ─► Financial ─► Commerce ─► NGO/donor approval ─► PayPal Sandbox ─► dashboard
          (needs,       (route,      (basket,
           access)       usable €)    reserve)
```

## Status

| Part                                    | State                          |
| --------------------------------------- | ------------------------------ |
| Monorepo, contracts, samples, AI client | ✅ Done                        |
| Shared PayPal client, route placeholders | ✅ Done                       |
| Database schema, seed, Postman, Render config | ✅ Done (no migration run yet) |
| Situation Intelligence + Orchestrator   | ⏳ In progress (Member 1)      |
| Financial Intelligence + payouts        | ⏳ In progress (Member 2)      |
| Commerce Intelligence + donor checkout  | ✅ Implemented; Sandbox/database manual verification pending (Member 3) |

What is real, sandbox-tested or simulated: [integration status](docs/integration-status.md).

## Timeline

| Day           | Goal                                                                       |
| ------------- | -------------------------------------------------------------------------- |
| Day 1 · 6 Nov | Supabase + PayPal sandbox set up; each module's core works on its sample   |
| Day 2 · 7 Nov | AI + rules tested, module pages built; **PRs into `main` in the evening**  |
| Day 3 · 8 Nov | Orchestrator, dashboard, donate flow, approval and payouts: demo works end to end |
| Day 4 · 9 Nov | Deploy on Render, integration status, Postman, end-to-end test, demo video |
| 10–12 Nov     | Buffer only. Submit before **12 Nov 12:00 PT**                              |

Day-by-day tasks are in each member's handoff.

## Tech stack (free tier)

| Layer             | Technology                                  |
| ----------------- | ------------------------------------------- |
| Frontend          | Next.js, React, TypeScript, Tailwind CSS    |
| Dashboard         | AG Grid Community, Recharts                 |
| Backend           | Node.js, Express, TypeScript                |
| Contracts         | Shared TypeScript types + Zod validation    |
| LLM               | Groq (primary), Gemini (fallback)           |
| Database          | Supabase PostgreSQL + Prisma                |
| Product discovery | Channel3 API + local merchant registry      |
| Payments          | PayPal Sandbox                              |
| Hosting           | Render                                      |
| API testing       | Postman, Vitest + Supertest                 |

## Repository layout

```
apps/web/                 Next.js frontend: one page per module + dashboard
apps/api/src/
  ai/                     Shared LLM client (Groq → Gemini fallback)
  rules/                  Deterministic decision engine (no AI)
  modules/                situation/ · finance/ · commerce/  (one per member)
  integrations/           paypal/ · channel3/
  orchestration/          Chains the three modules (integration phase)
  routes/ middleware/ config/ database/ utils/
packages/contracts/       Shared request/response schemas + sample JSON
prisma/                   Shared database schema
tests/                    Unit and integration tests
postman/                  API collection
docs/                     Architecture, AI design, PayPal, contracts, workflow
```

## Getting started

Requires Node.js 22 or later.

```bash
npm install                 # also generates the Prisma client
cp .env.example .env        # add your own keys
npm test                    # should pass before you start
npm run dev                 # API → http://localhost:4000, web → http://localhost:3000
```

The API process can start without external keys. The implemented Member 3 endpoints require PostgreSQL, and donor checkout also requires PayPal Sandbox credentials; Channel3 and the LLM have local/deterministic fallbacks.

### Keys you need

| Variable                                 | Where to get it                               | Needed by      |
| ---------------------------------------- | --------------------------------------------- | -------------- |
| `GROQ_API_KEY`, `GROQ_MODEL`             | console.groq.com                              | All modules    |
| `GEMINI_API_KEY`, `GEMINI_MODEL`         | aistudio.google.com (optional fallback)       | All modules    |
| `DATABASE_URL`, `DIRECT_URL`             | Supabase → Connect                            | Saving results |
| `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`, `PAYPAL_BASE_URL` | developer.paypal.com → Sandbox app; base URL must remain `https://api-m.sandbox.paypal.com` | Member 3 donor checkout |
| `PAYPAL_WEBHOOK_ID`                      | PayPal Sandbox app webhook (after deployment) | Member 3 donation webhooks; set after registration |
| `CHANNEL3_API_KEY`                       | Channel3 (optional; local synthetic registry works without it) | Commerce |

Each module can be built and tested with the sample JSON in `packages/contracts/samples/` before the others exist.

### Database (Supabase)

1. Create a free project at supabase.com.
2. **Connect** → copy the transaction pooler URL into `DATABASE_URL` and the session URL into `DIRECT_URL`.
3. `npm run db:migrate` to create the tables (the shared Prisma schema already defines Basket, BasketItem, and Donation; no Member 3 schema migration was added).
4. `npm run db:seed` to add the demo NGO user and the demo campaign `camp_demo`.

Member 3 does this once on Day 1 and shares the two URLs privately.

Free Supabase projects pause after a week without activity. Open the dashboard before a demo.

## Scripts

| Command               | What it does                               |
| --------------------- | ------------------------------------------ |
| `npm run dev`         | Start API and web together                 |
| `npm run dev:api`     | Start only the API                         |
| `npm run dev:web`     | Start only the web app                     |
| `npm run typecheck`   | Type-check every package                   |
| `npm test`            | Run all tests                              |
| `npm run build`       | Production build                           |
| `npm run db:validate` | Validate the Prisma schema                 |
| `npm run db:migrate`  | Create/apply migrations                    |
| `npm run db:seed`     | Add the demo NGO user and campaign         |
| `npm run db:studio`   | Browse the database                        |

## Documentation

- [Project overview](docs/project-overview.md)
- [Architecture](docs/architecture.md)
- [AI design](docs/ai-design.md)
- [PayPal integration](docs/paypal-integration.md)
- [Integration status](docs/integration-status.md): what's real, sandbox-tested or simulated
- [API contracts](docs/api-contracts.md)
- [Git workflow](docs/git-workflow.md): read this before you start
- Handoffs: [Member 1](docs/handoffs/member-1-situation.md) · [Member 2](docs/handoffs/member-2-financial.md) · [Member 3](docs/handoffs/member-3-commerce.md)

## Known limitations

- All demo data (recipients, merchants, locations, fees) is synthetic.
- PayPal runs in Sandbox only. Sandbox proves a technical workflow, not permission to operate real payments.
- Any simulated payout is labelled as a demo fallback in the UI.

## Licence

[MIT](LICENSE)
