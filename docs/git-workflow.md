# Git workflow

## Branches

| Branch                           | Owner    | Owns                                                                 |
| -------------------------------- | -------- | -------------------------------------------------------------------- |
| `main`                           | Everyone (via PR) | Shared foundation, contracts, schema, final integration     |
| `feature/situation-agent`        | Member 1 | `apps/api/src/modules/situation/`, `integrations/groq/`, `routes/situation.routes.ts`, `tests/situation/` |
| `feature/financial-intelligence` | Member 2 | `apps/api/src/modules/finance/`, `routes/finance.routes.ts`, `tests/finance/` |
| `feature/commerce-payments`      | Member 3 | `apps/api/src/modules/commerce/`, `integrations/paypal/`, `routes/commerce.routes.ts`, `routes/payment.routes.ts`, `tests/commerce/` |

## Shared files: change only through a small PR to `main`

- `packages/contracts/**`
- `prisma/schema.prisma`
- Root config: `package.json`, `tsconfig.base.json`, `.env.example`
- `apps/api/src/app.ts`, `middleware/`, `config/`

Tell the team before opening it, merge it quickly, then everyone updates their branch.

## First time

```bash
git clone https://github.com/FathimaMehrinVS/LIFELINE_PayPal_AI_Hackathon.git
cd LIFELINE_PayPal_AI_Hackathon
git checkout feature/<your-branch>
npm install
cp .env.example .env
```

## Daily

```bash
git checkout feature/<your-branch>
git pull

# keep up to date with main
git fetch origin
git merge origin/main

# work, then
git add <files>
git commit -m "feat(situation): extract needs from message"
git push
```

## Commit messages

`<type>(<scope>): <what changed>`

Types: `feat`, `fix`, `refactor`, `test`, `docs`, `chore`.
Scopes: `situation`, `finance`, `commerce`, `payments`, `web`, `api`, `contracts`, `db`.

## Merging

1. Run `npm run typecheck` and `npm test` locally.
2. Open a PR from your branch into `main`.
3. Another member reviews it.
4. Resolve conflicts in your own branch, never by overwriting someone else's work.
5. Nobody pushes directly to `main`.

## Never commit

`.env`, API keys, `node_modules/`, `.next/`, generated Prisma client.
