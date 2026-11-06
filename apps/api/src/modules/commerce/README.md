# Commerce Intelligence — Member 3 (`feature/commerce-payments`)

AI: **Ranking Agent**. Also owns the PayPal donor checkout. Full plan: `docs/handoffs/member-3-commerce.md`.

Input `CommerceRequest` → output `CommerceResult` (`packages/contracts/src/commerce.ts`):
basket items, alternatives, total, reserve, unmet needs, explanation.

- Products come from Channel3 (`src/integrations/channel3/`) and the local merchant registry
  (`registry.json`, synthetic), behind one `ProductSource` interface.
- The LLM matches and ranks products. Totals, reserve and "does it fit" are code in `src/rules/basket.ts`.
- If the basket doesn't fit, substitute cheaper items, list `unmet_needs`, and return the revised plan.
- Donor checkout: `src/integrations/paypal/orders.ts` + `src/routes/donation.routes.ts`.
- Frontend: `apps/web/app/commerce/`, `apps/web/app/donate/`. Tests: `tests/commerce/`.
