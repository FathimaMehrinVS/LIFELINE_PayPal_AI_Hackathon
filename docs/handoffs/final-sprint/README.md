# LIFELINE final sprint: team handoff

**Deadline:** 13 Nov 2026, 1:30 am IST. **We submit on 12 Nov.**
**Your tasks:** [Member 1](member-1.md) · [Member 2](member-2.md) · [Member 3](member-3.md)

This folder replaces the older `docs/handoffs/member-*.md` files for all remaining work.

**How to keep this up to date:** change task status only in the board below, change task details in that member's
file, and add one line to the change log at the bottom every time.

## What we are building

> **LIFELINE turns a messy emergency report into a verified, costed, NGO-approved aid plan that donors can fund, and
> records every step until the goods reach the family.**

**Main user:** a small or local NGO. **Also:** donors and suppliers. **Families need no account, bank or PayPal.**

**Rule to protect:** AI understands, rules verify, NGOs decide, donors fund, partners deliver. LIFELINE never decides
who deserves aid.

## The workflow

| # | Step | Who | State after it |
|---|---|---|---|
| 1 | Report by voice, tap or text | Family, relative or NGO worker | Case created |
| 2 | AI extracts the facts and asks only what blocks a decision | AI, then rules | Analysed |
| 3 | Rules compare routes, including the partner route | Rules | Route chosen |
| 4 | Basket built with real quantities and an approved supplier | AI ranks, rules cap | Plan ready |
| 5 | NGO approves the plan and picks the supplier | NGO | Allocation and purchase order |
| 6 | Donor funds that plan through PayPal Sandbox | Donor | Donation captured |
| 7 | NGO records the supplier payment (separate from the donation) | NGO | Supplier paid (simulated) |
| 8 | Supplier accepts, prepares, marks ready | Supplier | Ready for collection |
| 9 | Family collects with a pickup code | Family, partner | Handed over |
| 10 | NGO confirms; donor sees the timeline | NGO, donor | Delivery confirmed |

**The timeline only shows recorded events.** A captured donation never means "Delivered".

## Task board

Status: `todo` · `doing` · `blocked` · `done`

| ID | Task | Owner | Needed by | Depends on | Status |
|---|---|---|---|---|---|
| M1-1 | Database migration (blocks most tasks) | Member 1 | 8 Nov | none | done |
| M1-2 | Remove bad products; Channel3 first, local fallback | Member 1 | 8 Nov | none | done |
| M1-3 | NGO amount, household details, kits, real quantities | Member 1 | 9 Nov | none | done |
| M1-4 | Supplier API, AG Grid page, seed data, scorecard | Member 1 | 9 Nov | M1-1 | done |
| M1-5 | NGO-first request page | Member 1 | 9 Nov | M1-3 | done |
| M1-6 | Dashboard: saved status, new columns, timeline | Member 1 | 10 Nov | M2-3, M2-4 | blocked |
| M1-7 | Donor plans list and progress page | Member 1 | 10 Nov | M1-6 | done |
| M1-8 | Deploy to Render; register PayPal webhook | Member 1 | 11 Nov | M3-2 helps | todo |
| M1-9 | README, status doc, demo script, video, Devpost | Member 1 | 12 Nov | all | doing |
| M2-1 | Partner route and plain-language explanations | Member 2 | 8 Nov | none | todo |
| M2-2 | Approve the real cost | Member 2 | 9 Nov | M1-1 | todo |
| M2-3 | Purchase orders | Member 2 | 9 Nov | M1-1, M1-4 | todo |
| M2-4 | Fulfilment events and pickup code | Member 2 | 10 Nov | M2-3 | todo |
| M2-5 | Supplier payment record | Member 2 | 10 Nov | M2-3 | todo |
| M2-6 | Risk levels and price check | Member 2 | 10 Nov | M2-3 | todo |
| M3-1 | Login and roles | Member 3 | 9 Nov | none | done |
| M3-2 | One successful PayPal Sandbox capture | Member 3 | 9 Nov | none | todo |

## Working on `main`

We no longer use feature branches. **All three members work on the same branch, `main`.** Do not create new branches.

1. `git pull origin main` before you start and again before you push.
2. Make small commits and push often.
3. Run `npm run typecheck && npm test` before every push. Never push a failure to `main`.
4. Stay in your own files (see each member's file). Tell the team before editing `packages/contracts`,
   `prisma/schema.prisma`, `apps/api/src/app.ts` or `apps/web/services/api.ts`.
5. **Only Member 1 runs `prisma migrate dev`.** Everyone else runs `npx prisma migrate deploy`. `migrate dev` can
   offer to reset the shared database. If you need a database change, ask Member 1. The login migration is already
   on `main`, so M1-1 builds on top of it.

## Database changes (M1-1)

Two tables extended, three added, in one migration. Column names may change slightly during M1-1; `schema.prisma`
is the final word.

| Table | Change |
|---|---|
| `Merchant` (our supplier table) | Add `status` (PENDING, APPROVED, SUSPENDED), `serviceAreas`, `categories`, `contact` |
| `Payout` | Add optional `purchaseOrderId` and `reference`. This is how a supplier payment is recorded |
| `PurchaseOrder` (new) | `allocationId` (unique), `merchantId`, `amount`, `currency`, `fulfilmentStatus`, `pickupCodeHash`, `expectedReadyAt` |
| `FulfilmentEvent` (new, add-only) | `purchaseOrderId`, `status`, `actorId`, `evidenceType`, `note`, `createdAt` |
| `SupplierIncident` (new) | `merchantId`, optional `purchaseOrderId`, `severity`, `description`, `status`, `createdAt` |

Purchase order line items come from the existing `BasketItem` rows, so they are not stored twice. Supplier
verification is recorded in `AuditLog`.

**Fulfilment status:** `AWAITING_ACCEPTANCE`, `ACCEPTED`, `PREPARING`, `READY`, `DISPATCHED`, `HANDED_OVER`,
`RECIPIENT_CONFIRMED`, `ISSUE_REPORTED`.

## Endpoints we are agreeing on

| Endpoint | Owner | Access |
|---|---|---|
| `GET/POST /api/suppliers`, `POST /api/suppliers/:id/status` | Member 1 | NGO |
| `GET /api/plans`, `GET /api/plans/:id`, `GET /api/plans/contributions` (no family details) | Member 1 | NGO, donor (login required for now) |
| `GET /api/records/ledger`, `GET /api/records/audit` | Member 1 | NGO |
| `GET /api/cases/:id/timeline` | Member 1 | NGO |
| `POST /api/allocations/approve` with `case_id`, `campaign_id`, `merchant_id` (server works out the amount) | Member 2 | NGO |
| `GET /api/purchase-orders` | Member 2 | NGO, supplier (own orders) |
| `POST /api/purchase-orders/:id/events` | Member 2 | NGO, supplier |
| `POST /api/purchase-orders/:id/handover` with the pickup code | Member 2 | NGO, supplier |
| `POST /api/payments/payouts` with `purchase_order_id` | Member 2 | NGO |

## Protect the families

Donor pages and `/api/plans` must never show names, exact locations, photos or the original message. Show the need,
items, cost and progress only. Never require photos or ID documents for a family to receive aid.

## What we say is real

| Real | Sandbox | Simulated, labelled in the UI | Synthetic, labelled in the UI |
|---|---|---|---|
| Groq, Channel3, rules, NGO approval, purchase orders, audit records | PayPal donation | Supplier payment, goods preparation, delivery | Suppliers, their history, routes, fees |

Do not claim funding works until a capture has actually succeeded.

## Not building

Elastic, two-person approval, donor supplier preference, automated fraud detection, GPS tracking, family accounts,
blockchain, more AI agents.

## Final test (everyone, 11 Nov)

- [ ] A family with no bank, no wallet and a damaged phone gets a plan through the partner route
- [ ] The basket has sensible items and quantities, and no irrelevant products
- [ ] NGO approves with an approved supplier; a suspended supplier cannot be chosen
- [ ] Donor sees the plan with no family details, pays, and the capture is confirmed by the server
- [ ] Supplier payment shows as simulated and is separate from the donation
- [ ] Supplier moves the order to Ready; a wrong pickup code fails, the right one works
- [ ] Refreshing the dashboard keeps every status
- [ ] The donor timeline matches what was recorded and shows nothing early
- [ ] Each role sees only its own pages; a donor cannot approve

## Change log

Add newest first.

| Date | Who | What changed | Affects |
|---|---|---|---|
| 9 Nov | Member 1 | Workspace page removed; `/workspace` now redirects. People land on Overview (NGO), Approved Plans (donor) or Delivery Tracking (partner). Use `homeFor` from `lib/home.ts` | Everyone |
| 9 Nov | Member 1 | Added `/api/plans` and `/api/records`, donor pages, Payments and Audit Logs. Donations nav now opens Approved Plans. Rewrote the Financial Assessments page (old `finance/components` removed) and restyled Donate and home. M1-6 is waiting on M2-3 and M2-4 | Everyone |
| 8 Nov | Member 3 | Login/profile provisioning and role-based authorization are complete on `main` (`4e93e02`). API roles come from the verified Supabase user and linked `User` profile; protected routes enforce authentication, role, and ownership checks. M3-2 remains open until a real Sandbox capture is confirmed | Everyone |
| 8 Nov | Member 1 | Final sprint handoff created | Everyone |
