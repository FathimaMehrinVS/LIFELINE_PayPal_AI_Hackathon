# Commerce Intelligence — Member 3 (`feature/commerce-payments`)

`POST /api/commerce/basket` accepts `CommerceRequest` and returns `CommerceResult` from
`packages/contracts/src/commerce.ts`.

## Product sources

- `registry.json` contains 25 synthetic products across food, water, medicine, hygiene, baby supplies, clothing,
  shelter and household essentials. The four merchant labels are demo-only; database merchant rows remain
  `verified: false`.
- `product-source.ts` defines `ProductSource`, `LocalRegistrySource`, `Channel3Source` and a composite source.
- Channel3 is queried server-side at `/v1/search` when `CHANNEL3_API_KEY` is configured. Missing credentials,
  upstream errors and timeouts return no Channel3 candidates; the local registry remains available.

## Ranking and basket rules

`service.ts` makes one schema-validated LLM call to rank product IDs and provide short reasons. If the call fails,
the service falls back to a deterministic order. The model is never authoritative for price or arithmetic.

`rules/basket.ts` assigns one item per covered requested need, quantity 1, chooses ranked affordable candidates,
uses cheaper candidates when the preferred item does not fit, lists alternatives, and reports unmet needs. It uses
integer cents for calculations and defaults to reserving 20% of budget when feasible. Catalogue prices control
the total; local prices are labelled illustrative and Channel3 prices as estimates.

The service persists the request, Basket, selected BasketItems, and corresponding Product/Merchant rows using
Prisma. No schema migration is required.

The web page is `apps/web/app/commerce/page.tsx`. Tests under `tests/commerce/` cover budget constraints,
arithmetic, reserve, substitutions, unmet needs, fallback and route validation.
