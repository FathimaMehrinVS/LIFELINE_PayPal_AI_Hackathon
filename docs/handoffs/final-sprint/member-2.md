# Member 2 (Fathima Mehrin V S): routes, approval, procurement, delivery

Back to the [team board](README.md). Update status there, and details here.

**Your files:** `apps/api/src/modules/finance/`, `rules/fees.ts`, `rules/accessibility-score.ts`,
`rules/route-eligibility.ts`, new `rules/risk-level.ts` and `rules/fulfilment.ts`, new `modules/procurement/`,
`routes/allocation.routes.ts`, `routes/payout.routes.ts`, new `routes/purchase-orders.routes.ts`, `apps/web/app/finance/`.

Database changes go through Member 1 (M1-1). Please don't run `prisma migrate dev`.

## M2-1 Partner route and plain explanations · 8 Nov

- Today a family with no bank and no wallet gets no route, which is the exact family our pitch describes.
- Add a synthetic `route_partner` (`direct_merchant` type, illustrative fee). It must not need the family's bank,
  wallet or phone.
- It should only be verified when an APPROVED supplier covers the case location. Agree with Member 1 how `routesFor`
  receives the location.
- Update `explanation.prompt.ts`: no internal codes, flags or scores in the text.
- Done when: that family reaches a plan, and the explanation reads naturally to a non-expert.

## M2-2 Approve the real cost · 9 Nov · needs M1-1

- Today approval uses the whole budget, so a donor could be asked for €300 against a €15.50 basket.
- The server works out the amount: basket total plus the route fee on that total. Remove `amount` from the request.
- Add `merchant_id` to the request. Reject any supplier that isn't APPROVED.
- Done when: the allocation equals the plan's cost, with tests.

## M2-3 Purchase orders · 9 Nov · needs M1-1 and M1-4

- Create the purchase order in the same transaction as the approval, so one can't exist without the other.
- Line items come from `BasketItem`. Start at `AWAITING_ACCEPTANCE`.
- Build `GET /api/purchase-orders`. A supplier sees only its own orders.
- Write an audit event for every purchase order action.

## M2-4 Fulfilment and pickup code · 10 Nov · needs M2-3

- Put the allowed status moves in `rules/fulfilment.ts`, and reject anything else.
- Each change adds a `FulfilmentEvent` and updates the order in one transaction. Never edit or delete events.
- Generate a one-time pickup code at `READY`. Show it once, store only a hash, and limit wrong attempts.
- A supplier can never set `RECIPIENT_CONFIRMED`. That needs the code plus the NGO or the recipient.
- Never require photos or ID.

## M2-5 Supplier payment · 10 Nov · needs M2-3

- Extend the existing simulated disbursement to take `purchase_order_id` and a `reference`.
- Keep the check that captured donations cover the payment, and stop duplicates.
- A supplier payment must stay separate from the donation and always be labelled simulated.

## M2-6 Risk levels · 10 Nov · needs M2-3

- Add one rules function returning `NORMAL`, `URGENT` or `HIGH_RISK`.
- `URGENT`: high or critical urgency with only non-essential facts missing. Don't block it.
- `HIGH_RISK`: suspended supplier, conflicting payment details, or a price far above the usual range. Hold that
  transaction.
- Urgency never bypasses a financial check.
- Add it to the case data so the dashboard Risk column can show it.

**If you fall behind, cut in this order:** the price check inside M2-6, `DISPATCHED` as a separate step.
