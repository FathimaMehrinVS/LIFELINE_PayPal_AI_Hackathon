# Commerce Intelligence — Member 3 (`feature/commerce-payments`)

Agents: **Commerce Agent**, **Decision Agent**, **PayPal Agent**.

Input `CommerceRequest` → output `CommerceResult` (`packages/contracts/src/commerce.ts`):
basket items, alternatives, total, reserve, unmet needs, explanation.

- Products come from Channel3 (`src/integrations/channel3/`) and the local merchant registry
  (synthetic data in PostgreSQL, searched with PostgreSQL full-text search).
- The LLM matches and ranks products. Totals, reserve and "does it fit" are code in `src/rules/basket.ts`.
- If the basket doesn't fit, substitute cheaper items, list `unmet_needs`, and return the revised plan.
- Payments: `src/integrations/paypal/` + `src/routes/payment.routes.ts`.
- Frontend: `apps/web/app/commerce/`. Tests: `tests/commerce/`.
