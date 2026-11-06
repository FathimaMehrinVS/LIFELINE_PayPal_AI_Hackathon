# Handoff: Member 3, Commerce Intelligence

**Branch:** `feature/commerce-payments` · **Effort:** ~25 hours over 4 days

| Part              | What you build                                                         |
| ----------------- | ---------------------------------------------------------------------- |
| AI                | **Ranking Agent**: matches and ranks products against needs, explains the basket |
| Rules (no AI)     | Basket fit, reserve, cheaper substitutions, unmet needs                |
| External service  | **PayPal donor checkout** (Orders) + **Channel3** product search       |
| Frontend          | Basket page + donate flow                                              |
| Final-day job     | Demo merchant data, end-to-end test                                    |

**You will learn:** search and ranking, recommendation, budget optimisation, LLM tool use over real APIs, the full
payment checkout lifecycle.

PayPal donor checkout is the hackathon's core judging point, so it comes **first**, on Day 1.

---

## 1. Setup (1 h, including accounts)

```bash
git clone https://github.com/FathimaMehrinVS/LIFELINE_PayPal_AI_Hackathon.git
cd LIFELINE_PayPal_AI_Hackathon
git checkout feature/commerce-payments
npm install
cp .env.example .env
npm test
```

You set up two shared accounts for the team on Day 1:

- **Supabase:** create a free project → Connect → copy the pooler URL into `DATABASE_URL` and the session URL
  into `DIRECT_URL` → `npm run db:migrate` → `npm run db:seed` (creates the demo NGO user and campaign
  `camp_demo`) → share both URLs with the team privately (not in git)
- **PayPal:** developer.paypal.com → Apps & Credentials → **Sandbox** → Create App → `PAYPAL_CLIENT_ID`,
  `PAYPAL_CLIENT_SECRET` → share with Member 2. Note the sandbox **buyer** account for testing.

Your own keys: `GROQ_API_KEY` + `GROQ_MODEL` (console.groq.com), `CHANNEL3_API_KEY`.

## 2. Files you own (only these)

| Path                                           | What goes there                              |
| ---------------------------------------------- | -------------------------------------------- |
| `apps/api/src/integrations/paypal/orders.ts`   | Create and capture donor orders              |
| `apps/api/src/integrations/channel3/`          | Channel3 search client                       |
| `apps/api/src/modules/commerce/`               | `registry.json`, `local-registry.ts`, `channel3-source.ts`, `prompts.ts`, `commerce.service.ts` |
| `apps/api/src/rules/basket.ts`                 | Basket fit, reserve, substitutions           |
| `apps/api/src/routes/commerce.routes.ts`       | `POST /api/commerce/basket`                  |
| `apps/api/src/routes/donation.routes.ts`       | `POST /api/payments/donations`, `POST /api/payments/donations/:id/capture` |
| `apps/web/app/commerce/`                       | Basket page                                  |
| `apps/web/app/donate/`                         | Donate page + PayPal return page             |
| `tests/commerce/`                              | Your tests                                   |
| `tests/integration/end-to-end.test.ts`         | End-to-end test (Day 4)                      |

`integrations/paypal/client.ts` (OAuth token + `paypalFetch`) is shared and already in `main`. Use it, don't edit it.
Member 2 owns `webhooks.ts` and `payouts.ts` in the same folder.

## 3. Your contracts

| Endpoint                                  | Input                   | Output           |
| ----------------------------------------- | ----------------------- | ---------------- |
| `POST /api/commerce/basket`               | `CommerceRequest` (`samples/commerce-request.json`) | `CommerceResult` (`samples/commerce-result.json`) |
| `POST /api/payments/donations`            | `CreateDonationRequest` | `DonationResult` |
| `POST /api/payments/donations/:id/capture`| —                       | `DonationResult` |

Your basket `budget` is Member 2's `usable_value`. Use the sample (€285) until Day 3.
Full PayPal flow: `docs/paypal-integration.md`.

---

## 4. Day-by-day

### Day 1 · 6 Nov · accounts + PayPal donor checkout (~7 h)

- [ ] **Supabase + PayPal accounts**, shared with the team (see Setup) (1 h)
- [ ] **Payouts check** (0.5 h): in the sandbox app's features, is Payouts enabled? **Tell the team tonight.**
  It decides whether Member 2 builds a real or a simulated payout.
- [ ] **`integrations/paypal/orders.ts`** (2 h), using `paypalFetch` from `client.ts`
  - create: `POST /v2/checkout/orders` with `intent: "CAPTURE"`, the amount as a 2-decimal string (`"300.00"`),
    and return / cancel URLs pointing at `<web>/donate/return`. Return the approval link.
  - capture: `POST /v2/checkout/orders/{id}/capture`
- [ ] **`routes/donation.routes.ts`** (2 h): create stores a `Donation` (`CREATED`, `paypalOrderId`); capture
  updates it to `CAPTURED` with `paypalCaptureId`. Use `getPrisma()` from `src/database/prisma.ts`.
- [ ] **Manual test** (1.5 h): create in Postman → open the approval URL → log in as the sandbox buyer → capture →
  check the row in `npm run db:studio`

**Checkpoint tonight:** a sandbox donation goes from created to captured and is stored.

### Day 2 · 7 Nov · Commerce Intelligence (~7 h)

- [ ] **`modules/commerce/registry.json`** (1 h): 20–30 synthetic products from 4–5 verified local merchants
  covering every need category, with prices in EUR, availability and `accepts` payment methods
- [ ] **Product sources** (3 h), behind one interface so they're swappable:

  ```ts
  interface ProductSource {
    search(needs: NeedCategory[], location: string, currency: string): Promise<BasketItem[]>;
  }
  ```

  - `local-registry.ts`: filters `registry.json`, `source: "local_registry"`
  - `channel3-source.ts`: one Channel3 search per need, mapped to `BasketItem` with `source: "channel3"`,
    `availability: "unknown"` (an online catalogue doesn't prove local availability), `price_label: "estimate"`.
    Cache responses in memory while developing to save credits.
- [ ] **`rules/basket.ts` + tests** (2 h), plain code, use `utils/money.ts`:
  - spendable = `budget × (1 − reserve_ratio)`
  - take the top-ranked product per need; if the total doesn't fit, swap in cheaper candidates (keep the replaced
    ones in `alternatives`); if a need still can't fit, add it to `unmet_needs`
  - `reserve = budget − total`, never negative
  - tests: the sample (total 221, reserve 64) and the over-budget case (€350 of goods vs €300)
- [ ] **Ranking Agent** in `commerce.service.ts` (1 h): **one** LLM call with all candidates for all needs.
  The LLM returns product IDs in ranked order per need plus an explanation; your rules build the basket. The LLM
  never sets prices or totals.

**Evening:** open your PR into `main`; review one teammate's PR (10 min).

### Day 3 · 8 Nov · UI + donate flow (~6 h)

Merge `main` into your branch first.

- [ ] **Basket page** `apps/web/app/commerce/page.tsx` (2.5 h): items with source badge (Local registry /
  Channel3), availability, price label, subtotal; alternatives; total, reserve, unmet needs; explanation. Use
  `api.buildBasket`.
- [ ] **Donate flow** `apps/web/app/donate/` (2.5 h)
  - donate page: amount + "Donate with PayPal" → `api.createDonation` → redirect to `approval_url`
  - return page (`/donate/return?token=...`): calls `api.captureDonation`, then shows the status **from the
    backend**, never from the redirect alone
  - cancel → a clear "Donation cancelled" message
- [ ] **Tests** for `orders.ts` with a mocked `fetch` (1 h)

**Checkpoint tonight:** donate → PayPal sandbox → back → captured, and the basket page works with the sample.

### Day 4 · 9 Nov · demo-ready (~5 h)

- [ ] **`tests/integration/end-to-end.test.ts`** (2 h): with a fake LLM and mocked PayPal/Channel3, run
  `/api/cases` and the donation endpoints and check each step's output
- [ ] **Demo data** (1 h): make the registry and scenario match the demo script (the €300 family)
- [ ] **Bug fixes** from the end-to-end run (2 h)

---

## 5. Definition of done

- [ ] Sandbox donation: create → approve → capture, stored in the database
- [ ] Payouts check result shared with the team on Day 1
- [ ] Sample basket → total ≤ spendable, reserve ≥ 20%, sources and labels set
- [ ] Over-budget case substitutes cheaper items and lists unmet needs
- [ ] Channel3 results shown next to local registry results
- [ ] Basket page and donate flow work end to end

## 6. If you fall behind, cut in this order

1. Channel3 → local registry only (say so in the integration status doc)
2. End-to-end test → a manual test checklist
3. Alternatives list → only `unmet_needs`

## 7. Rules

- PayPal credentials stay on the backend, never in `apps/web`.
- A donation is complete only when PayPal confirms the capture, never because the browser reached a page.
- Don't call authorisation "escrow" or the internal ledger "PayPal balance".
- The LLM ranks and explains. Prices, totals and the reserve are code.
- Don't commit `.env` or share keys in git. Send them privately.

## 8. Handover points

| You give                                   | To       | When          |
| ------------------------------------------ | -------- | ------------- |
| Supabase URLs, PayPal sandbox credentials  | Everyone | Day 1         |
| Payouts enabled: yes / no                  | Member 2 | Day 1         |
| `buildBasket()`                            | Member 1 (Orchestrator) | Day 2 evening (merged) |
| Captured `Donation` rows                   | Member 2 (approval rule) | Day 2 evening (merged) |
| Working donate flow                        | Demo     | Day 3         |
