# Handoff: Member 2, Financial Intelligence

**Branch:** `feature/financial-intelligence` · **Effort:** ~25 hours over 4 days

| Part              | What you build                                                       |
| ----------------- | -------------------------------------------------------------------- |
| AI                | **Explanation Agent**: explains scores, flags and the recommendation |
| Rules (no AI)     | Fees, accessibility score, pass / review / block, approval rule      |
| External service  | **PayPal webhooks + payouts** (real sandbox or labelled simulation)  |
| Frontend          | Finance page                                                         |
| Final-day job     | Integration status doc (what's real vs simulated), Postman collection |

**You will learn:** explainable AI, anomaly detection, rule-based AI guardrails, classification, payment
security (webhook signature verification, idempotency), compliance thinking.

---

## 1. Setup (30 min)

```bash
git clone https://github.com/FathimaMehrinVS/LIFELINE_PayPal_AI_Hackathon.git
cd LIFELINE_PayPal_AI_Hackathon
git checkout feature/financial-intelligence
npm install
cp .env.example .env
npm test
```

In `.env`:

- `GROQ_API_KEY` + `GROQ_MODEL`: **your own** key from console.groq.com
- `DATABASE_URL`, `DIRECT_URL`: Member 3 shares these on Day 1
- `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`: Member 3 shares the sandbox app credentials on Day 1
- `PAYPAL_WEBHOOK_ID`: you create the webhook on Day 3

## 2. Files you own (only these)

| Path                                           | What goes there                               |
| ---------------------------------------------- | --------------------------------------------- |
| `apps/api/src/rules/fees.ts`                   | Fee, usable value, fee-anomaly flags          |
| `apps/api/src/rules/accessibility-score.ts`    | 0–100 score per route, versioned              |
| `apps/api/src/rules/route-eligibility.ts`      | pass / review / block                         |
| `apps/api/src/rules/approval.ts`               | Whether an allocation / payout may happen     |
| `apps/api/src/modules/finance/`                | `finance.service.ts`, `prompts.ts`, `route-catalogue.ts` |
| `apps/api/src/routes/finance.routes.ts`        | `POST /api/finance/evaluate`                  |
| `apps/api/src/routes/allocation.routes.ts`     | `POST /api/allocations/approve`               |
| `apps/api/src/routes/payout.routes.ts`         | `POST /api/payments/payouts`, `POST /api/payments/webhooks/paypal` |
| `apps/api/src/integrations/paypal/webhooks.ts` | Signature verification, idempotent processing |
| `apps/api/src/integrations/paypal/payouts.ts`  | Sandbox payout or simulated fallback          |
| `apps/web/app/finance/`                        | Finance page                                  |
| `tests/finance/`                               | Your tests                                    |
| `docs/integration-status.md`                   | What's real, sandbox-tested or simulated      |
| `postman/`                                     | API collection                                |

`integrations/paypal/client.ts` (OAuth token + `paypalFetch`) is shared and already in `main`. Use it, don't edit it.
Member 3 owns `orders.ts` in the same folder.

## 3. Your contracts

| Endpoint                          | Input                     | Output             |
| --------------------------------- | ------------------------- | ------------------ |
| `POST /api/finance/evaluate`      | `FinanceRequest` (`samples/finance-request.json`) | `FinanceResult` (`samples/finance-result.json`) |
| `POST /api/allocations/approve`   | `ApproveAllocationRequest` | `AllocationResult` (`packages/contracts/src/allocation.ts`) |
| `POST /api/payments/payouts`      | `CreatePayoutRequest`     | `PayoutResult`     |
| `POST /api/payments/webhooks/paypal` | PayPal event           | `200`              |

**Target for the sample:** bank `block` (bank unavailable), local agent `review` with a fee flag (20% vs 3–6%),
PayPal route `pass` and recommended with **€285 usable**.

## 4. The rule that matters most

**Scores, fees, flags, verdicts and approvals are deterministic TypeScript.** The same input always gives the same
output. The LLM only writes the explanation from numbers you've already calculated. This is what makes LIFELINE
safe, and it's what judges will ask about.

---

## 5. Day-by-day

### Day 1 · 6 Nov · the rules engine (~6.5 h)

- [ ] **`rules/fees.ts`** (1.5 h): use `roundMoney` / `percentOf` from `src/utils/money.ts`
  - `estimated_fee = fee_fixed + percentOf(amount, fee_percent)`
  - `usable_value = max(0, amount − estimated_fee)`
  - one reference-range table per route type (illustrative, label it so), e.g. paypal 3–6 %, digital_wallet 2–6 %,
    bank_transfer 0–5 %, cash_agent 3–8 %
  - above range → flag `FEE_ABOVE_REFERENCE`, severity `warning`, `evidence: { observed_percent,
    reference_min_percent, reference_max_percent }`. Wording: "Fee appears higher than the reference range; review
    recommended." Never "fraud".
- [ ] **`rules/accessibility-score.ts`** (2 h), version `"v1"`. Starting weights from the proposal:

  | Factor                 | Weight |
  | ---------------------- | ------ |
  | bank_availability      | 0.20   |
  | atm_access             | 0.10   |
  | wallet_acceptance      | 0.20   |
  | cash_availability      | 0.15   |
  | merchant_acceptance    | 0.15   |
  | connectivity           | 0.10   |
  | cash_out_affordability | 0.10 (from your fee result) |

  Points per status: `available` 1.0, `limited` 0.5, `unavailable` 0, `unknown` your choice (e.g. 0.25), **written
  down** in the file and shown in the UI. Score per route: use the factors that matter for that route (its
  `requires` + merchant_acceptance + connectivity + cash_out_affordability), rescale their weights to sum to 1, and
  return the breakdown in `factors`.
- [ ] **`rules/route-eligibility.ts`** (1 h)
  - `block`: route `unsupported`, or any `requires` factor `unavailable` (+ `critical` flag
    `REQUIRED_ACCESS_UNAVAILABLE`)
  - `review`: route `unverified`, any `requires` factor `unknown`, or any warning flag
  - `pass`: everything else
- [ ] **Unit tests** for all three with the sample request (2 h). These are the most valuable tests in the project.

**Checkpoint tonight:** your rules turn the sample request into the target result above (without the explanation).

### Day 2 · 7 Nov · the module (~6 h)

- [ ] **`modules/finance/finance.service.ts`** (1.5 h): `evaluateRoutes(input, llm)`
  1. assess every route with your rules
  2. recommend: among `pass` routes, highest `usable_value`, tie-break on score; none pass → `null`
  3. return `FinanceResult`
- [ ] **Explanation Agent** (1 h): one LLM call that gets the computed results

  ```ts
  const { explanation } = await llm.generateJson({
    system: EXPLANATION_PROMPT, // "Explain in 2–4 plain sentences. Use only the numbers given. Never call a fee fraud."
    user: JSON.stringify({ routes: assessments, recommended }),
    schema: z.object({ explanation: z.string() }),
  });
  ```

  If the LLM call fails, build a template explanation in code so the endpoint still works.
- [ ] **`modules/finance/route-catalogue.ts`** (0.5 h): 3–5 synthetic demo routes (like the sample) for the
  Orchestrator. Fees `illustrative` unless confirmed.
- [ ] **Wire the route + service tests** with a fake LLM (1 h)
- [ ] **Finance page** `apps/web/app/finance/page.tsx` (2 h): a card per route with fee, usable value, score bar,
  verdict badge (pass green / review amber / block red), flags with evidence ("20% vs reference 3–6%"), labels
  **estimate / confirmed / illustrative**, recommended route highlighted, explanation. Use `api.evaluateFinance`.

**Evening:** open your PR into `main`; review one teammate's PR (10 min).

### Day 3 · 8 Nov · money movement + compliance (~7 h)

Merge `main` into your branch first.

- [ ] **Webhooks** `integrations/paypal/webhooks.ts` + `payout.routes.ts` (3 h)
  - create a webhook in the PayPal sandbox app pointing at `<API URL>/api/payments/webhooks/paypal` (use a tunnel
    for local testing); copy its ID into `PAYPAL_WEBHOOK_ID` and share it
  - verify each event: `POST /v1/notifications/verify-webhook-signature` with the PayPal headers, your webhook ID
    and the event, via `paypalFetch`
  - store a `WebhookEvent` (`verified` true/false). The unique `eventId` means a duplicate is ignored.
  - on `PAYMENT.CAPTURE.COMPLETED`, mark the matching `Donation` as confirmed
- [ ] **`rules/approval.ts` + `allocation.routes.ts`** (2 h)
  - approve an eligible case as an NGO decision; captured campaign funds must be checked before a future payout,
    since donations are now linked to an already-approved allocation
  - store an `AidAllocation` with `APPROVED`, the approver and the time; write an `AuditLog` row
  - a payout may run only for an `APPROVED` allocation
- [ ] **Payouts** `integrations/paypal/payouts.ts` (2 h)
  - if Member 3's Day 1 check says Payouts is enabled: `POST /v1/payments/payouts`, `mode: "sandbox"`
  - otherwise: store a `Payout` with `mode: "SIMULATED"` and return `mode: "simulated"`. The UI must say **"Demo
    fallback: simulated payout"**.
  - unit tests with a mocked `fetch`

**Checkpoint tonight:** approve → payout works from Member 1's dashboard; a replayed webhook doesn't duplicate.

### Day 4 · 9 Nov · honesty + testing (~5.5 h)

- [ ] **`docs/integration-status.md`** (1.5 h), required by the submission rules: for every PayPal feature,
  Channel3, Groq and the database, state **real / sandbox-tested / simulated / not built**, and list known limitations
- [ ] **Postman collection** (2 h): every endpoint, success and failure examples, a test script per request
  (status code + key fields), exported to `postman/LIFELINE.postman_collection.json`
- [ ] **Bug fixes** from the end-to-end run (2 h)

---

## 6. Definition of done

- [ ] Sample request → bank `block`, agent `review` + fee flag, PayPal `pass` + recommended, €285 usable
- [ ] All rules unit-tested; same input, same output
- [ ] A blocked or unsupported route is never recommended
- [ ] Endpoint still answers if the LLM is down
- [ ] Webhooks verified and idempotent; no payout without an approved allocation
- [ ] Simulated payouts are labelled everywhere
- [ ] Integration status doc and Postman collection done

## 7. If you fall behind, cut in this order

1. Postman test scripts → keep the requests only
2. Webhooks → rely on the capture response (say so in the integration status doc)
3. Real payouts → simulated only

## 8. Rules

- The score explains. It never denies aid or lowers anyone's priority.
- Unknown is never treated as available.
- Never suggest workarounds to restrictions, KYC or sanctions.
- All money maths goes through `utils/money.ts`.
- PayPal credentials stay on the backend.

## 9. Handover points

| You give                                   | To       | When          |
| ------------------------------------------ | -------- | ------------- |
| `evaluateRoutes()` + `route-catalogue.ts`  | Member 1 (Orchestrator) | Day 2 evening (merged) |
| `POST /api/allocations/approve`            | Member 1 (dashboard)    | Day 3 |
| Webhook ID                                 | Everyone's `.env`       | Day 3 |
| Integration status doc                     | Submission              | Day 4 |

| You need                         | From     | When  |
| -------------------------------- | -------- | ----- |
| PayPal sandbox credentials + Payouts check result | Member 3 | Day 1 |
| Supabase connection strings      | Member 3 | Day 1 |
| Captured `Donation` rows         | Member 3 | Day 2 evening (merged) |
