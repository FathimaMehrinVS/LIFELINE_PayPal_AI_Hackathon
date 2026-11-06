# Financial Intelligence — Member 2 (`feature/financial-intelligence`)

Compares `available_routes` and returns a `FinanceResult` (see `packages/contracts/src/finance.ts`):
recommended route, estimated fee, accessibility score, risk flags and an explanation.

Fee calculations and risk rules must be deterministic code. The LLM may only rank and explain.
Wire it into `src/routes/finance.routes.ts` in place of the `notImplemented` handler.
