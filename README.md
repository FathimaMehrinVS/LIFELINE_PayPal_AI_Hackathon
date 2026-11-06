# LIFELINE

AI-Powered Humanitarian Financial Access and Payment Coordination Network.

A person describes their situation in plain language. LIFELINE works out what they need, finds the most
accessible and affordable way to move money, builds a basket of essentials within their budget, and pays
through PayPal Sandbox.

## Tech stack

| Layer     | Technology                                   |
| --------- | -------------------------------------------- |
| Frontend  | Next.js (App Router), React, TypeScript      |
| Backend   | Node.js, Express, TypeScript                 |
| Contracts | Shared TypeScript types + Zod validation     |
| Database  | PostgreSQL with Prisma                       |
| AI        | Groq                                         |
| Payments  | PayPal Sandbox                               |
| Tests     | Vitest + Supertest                           |

## Repository layout

```
apps/web/              Next.js frontend
apps/api/              Express backend
packages/contracts/    Shared request/response types used by web and api
prisma/                Shared database schema
tests/                 Unit and integration tests
docs/                  Architecture, API contracts, git workflow
```

## Getting started

Requires Node.js 22 or later.

```bash
npm install
cp .env.example .env    # fill in your own keys
npm run dev             # API on http://localhost:4000, web on http://localhost:3000
```

## Scripts

| Command               | What it does                                  |
| --------------------- | --------------------------------------------- |
| `npm run dev`         | Start API and web together                    |
| `npm run dev:api`     | Start only the API                            |
| `npm run dev:web`     | Start only the web app                        |
| `npm run typecheck`   | Type-check every package                      |
| `npm test`            | Run all tests                                 |
| `npm run build`       | Production build                              |
| `npm run db:validate` | Validate the Prisma schema                    |
| `npm run db:migrate`  | Create/apply migrations (needs PostgreSQL)    |

## Team

| Module                 | Branch                           |
| ---------------------- | -------------------------------- |
| Situation Agent        | `feature/situation-agent`        |
| Financial Intelligence | `feature/financial-intelligence` |
| Commerce & Payments    | `feature/commerce-payments`      |

See [docs/git-workflow.md](docs/git-workflow.md) before you start.
