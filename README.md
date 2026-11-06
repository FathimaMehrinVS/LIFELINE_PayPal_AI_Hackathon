# LIFELINE

AI-Powered Humanitarian Financial Access and Payment Coordination Network.

> Money should reach people. Access should reach them too.

A person describes a crisis in plain language. LIFELINE works out what they need and what financial access they
actually have, compares the routes for getting money to them, builds a basket of essentials within budget, and
handles the payment through PayPal Sandbox, with human approval before any money moves.

LIFELINE is not a bank, a wallet or a charity platform. It is a decision layer between people in crisis and the
payment infrastructure that still works.

## Three AI modules

| Module                     | Understands                                   | Branch                           |
| -------------------------- | --------------------------------------------- | -------------------------------- |
| Situation Intelligence     | What happened, what is needed, what's missing | `feature/situation-agent`        |
| Financial Intelligence     | Whether money is usable, which route, fee risk | `feature/financial-intelligence` |
| Commerce Intelligence      | Which goods, from where, within budget; PayPal | `feature/commerce-payments`      |

AI extracts, compares, ranks and explains. Deterministic code calculates scores, fees and totals. Humans and
backend rules authorise payments.

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
  modules/                situation/ · finance/ · commerce/
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
npm run dev                 # API → http://localhost:4000, web → http://localhost:3000
```

The API starts without any keys; module endpoints return `501 NOT_IMPLEMENTED` until built.

### Database (Supabase)

1. Create a free project at supabase.com.
2. **Connect** → copy the transaction pooler URL into `DATABASE_URL` and the session URL into `DIRECT_URL`.
3. `npm run db:migrate` to create the tables.

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
| `npm run db:studio`   | Browse the database                        |

## Documentation

- [Project overview](docs/project-overview.md)
- [Architecture](docs/architecture.md)
- [AI design](docs/ai-design.md)
- [PayPal integration](docs/paypal-integration.md)
- [API contracts](docs/api-contracts.md)
- [Git workflow](docs/git-workflow.md): read this before you start

## Known limitations

- All demo data (recipients, merchants, locations, fees) is synthetic.
- PayPal runs in Sandbox only. Sandbox proves a technical workflow, not permission to operate real payments.
- Any simulated payout is labelled as a demo fallback in the UI.

## Licence

[MIT](LICENSE)
