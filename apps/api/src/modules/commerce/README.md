# Commerce Intelligence — Member 3 (`feature/commerce-payments`)

Builds a basket from needs and budget and returns a `CommerceResult` (see `packages/contracts/src/commerce.ts`):
items, total and remaining budget. The merchant/product catalogue lives here too.

Wire it into `src/routes/commerce.routes.ts` in place of the `notImplemented` handler.
