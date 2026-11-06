# Git workflow

## Branches and ownership

| Branch                           | Owner    | Owns                                                                                   |
| -------------------------------- | -------- | -------------------------------------------------------------------------------------- |
| `feature/situation-agent`        | Member 1 | `apps/api/src/modules/situation/`, `routes/situation.routes.ts`, `apps/web/app/situation/`, `tests/situation/` |
| `feature/financial-intelligence` | Member 2 | `apps/api/src/modules/finance/`, `rules/accessibility-score.ts`, `rules/fees.ts`, `rules/route-eligibility.ts`, `routes/finance.routes.ts`, `apps/web/app/finance/`, `tests/finance/` |
| `feature/commerce-payments`      | Member 3 | `apps/api/src/modules/commerce/`, `rules/basket.ts`, `integrations/channel3/`, `integrations/paypal/`, `routes/commerce.routes.ts`, `routes/payment.routes.ts`, `apps/web/app/commerce/`, `tests/commerce/` |
| `main`                           | Everyone, via PR only | Everything else, plus integration (`orchestration/`, `apps/web/app/dashboard/`) |

## Shared files: change only through a small PR to `main`

- `packages/contracts/**` (update the samples in the same PR)
- `prisma/schema.prisma`
- `apps/api/src/ai/`, `config/`, `middleware/`, `app.ts`
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
