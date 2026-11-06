# Git workflow

## Branches and ownership

| Branch                           | Owner    | Owns                                                                                   |
| -------------------------------- | -------- | -------------------------------------------------------------------------------------- |
| `feature/situation-agent`        | Member 1 | `apps/api/src/modules/situation/`, `rules/situation-checks.ts`, `routes/situation.routes.ts`, `routes/cases.routes.ts`, `orchestration/`, `apps/web/app/situation/`, `apps/web/app/dashboard/`, `tests/situation/`, `render.yaml` |
| `feature/financial-intelligence` | Member 2 | `apps/api/src/modules/finance/`, `rules/fees.ts`, `rules/accessibility-score.ts`, `rules/route-eligibility.ts`, `rules/approval.ts`, `routes/finance.routes.ts`, `routes/allocation.routes.ts`, `routes/payout.routes.ts`, `integrations/paypal/webhooks.ts`, `integrations/paypal/payouts.ts`, `apps/web/app/finance/`, `tests/finance/`, `docs/integration-status.md`, `postman/` |
| `feature/commerce-payments`      | Member 3 | `apps/api/src/modules/commerce/`, `rules/basket.ts`, `integrations/channel3/`, `integrations/paypal/orders.ts`, `routes/commerce.routes.ts`, `routes/donation.routes.ts`, `prisma/seed.ts`, `apps/web/app/commerce/`, `apps/web/app/donate/`, `tests/commerce/`, `tests/integration/end-to-end.test.ts` |
| `main`                           | Everyone, via PR only | Everything else |

No file is owned by two people. If you need to change a file you don't own, ask its owner.

## Shared files: change only through a small PR to `main`

- `packages/contracts/**` (update the samples in the same PR)
- `prisma/schema.prisma`
- `apps/api/src/ai/`, `config/`, `middleware/`, `app.ts`, `integrations/paypal/client.ts`
- `apps/web/services/api.ts`, `apps/web/app/layout.tsx`
- Root `package.json`, `package-lock.json`, `tsconfig.base.json`, `.env.example`

Tell the team first, merge it quickly, then everyone merges `main` into their branch.
New npm packages count as a shared change because they touch `package-lock.json`.

## First time

```bash
git clone https://github.com/FathimaMehrinVS/LIFELINE_PayPal_AI_Hackathon.git
cd LIFELINE_PayPal_AI_Hackathon
git checkout feature/<your-branch>
npm install
cp .env.example .env
npm test
```

## Daily

```bash
git checkout feature/<your-branch>
git pull

# stay up to date with main
git fetch origin
git merge origin/main

# work, then
git add <files>
git commit -m "feat(situation): extract access factors from message"
git push
```

## Commit messages

`<type>(<scope>): <what changed>`

Types: `feat`, `fix`, `refactor`, `test`, `docs`, `chore`.
Scopes: `situation`, `finance`, `commerce`, `payments`, `web`, `api`, `ai`, `rules`, `contracts`, `db`.

## Merging

1. `npm run typecheck` and `npm test` pass locally.
2. Open a PR from your branch into `main`.
3. Another member reviews it.
4. Resolve conflicts in your own branch, never by overwriting someone else's work.
5. Nobody pushes directly to `main`.

## Never commit

`.env`, API keys, `node_modules/`, `.next/`, `apps/api/src/generated/`, real personal data.
