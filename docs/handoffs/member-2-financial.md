# Handoff: Member 2, Financial Intelligence

**Branch:** `feature/financial-intelligence`
**Agents you own:** Financial Route, Accessibility, Cost & Anomaly, Risk & Compliance
**One-line job:** given the recipient's access situation and a list of money routes, work out which routes are
actually usable, what each costs, what is left for the family, and which one to recommend, with reasons.

---

## 1. Setup (30 min)

```bash
git clone https://github.com/FathimaMehrinVS/LIFELINE_PayPal_AI_Hackathon.git
cd LIFELINE_PayPal_AI_Hackathon
git checkout feature/financial-intelligence
npm install
cp .env.example .env
npm test                     # 17 tests should pass
```

In `.env` set `GROQ_API_KEY` (console.groq.com → API Keys) and `GROQ_MODEL` (a current model from
console.groq.com/docs/models). You only need the LLM for the explanation; everything else is plain code.

## 2. What you own

| Path                                          | What goes there                             |
| --------------------------------------------- | ------------------------------------------- |
| `apps/api/src/rules/accessibility-score.ts`   | 0–100 score per route                       |
| `apps/api/src/rules/fees.ts`                  | Fee, usable value, fee-anomaly flags        |
| `apps/api/src/rules/route-eligibility.ts`     | pass / review / block                       |
| `apps/api/src/modules/finance/`               | Service, explanation prompt, route catalogue |
| `apps/api/src/routes/finance.routes.ts`       | Replace the `notImplemented` handler        |
| `apps/web/app/finance/`                       | The Financial access page                   |
| `tests/finance/`                              | Your tests                                  |

Don't edit other members' folders. Contract or schema changes go through a small PR to `main`.

## 3. Your contract

- **Input:** `FinanceRequest`, see `packages/contracts/samples/finance-request.json`
- **Output:** `FinanceResult`, see `packages/contracts/samples/finance-result.json`
- Schema: `packages/contracts/src/finance.ts`

The `access` object in your input comes from Member 1's output. Don't wait for them: use the sample.
Your recommended route's `usable_value` becomes Member 3's basket budget.

**Target result for the sample:** bank blocked (bank unavailable), local agent flagged for its 20% fee, PayPal
route recommended with €285 usable.

## 4. The most important rule

**Scores, fees, flags and verdicts are deterministic TypeScript.** Same input gives the same output, every time.
The LLM only writes the `explanation` from numbers you have already calculated. This is what makes the
project safe and what judges will ask about.

## 5. Tasks

### Day 1 (7 Nov): the rules engine

- [ ] `rules/fees.ts`: use `roundMoney` / `percentOf` from `src/utils/money.ts`
  - `estimated_fee = fee_fixed + percentOf(amount, fee_percent)`
  - `usable_value = amount − estimated_fee` (never below 0)
  - reference fee ranges per route type in one table, for example (illustrative, label them so):

    | Route type      | Reference range |
    | --------------- | --------------- |
    | paypal          | 3–6 %           |
    | digital_wallet  | 2–6 %           |
    | bank_transfer   | 0–5 %           |
    | cash_agent      | 3–8 %           |

  - above the range → flag `FEE_ABOVE_REFERENCE`, severity `warning`, with
    `evidence: { observed_percent, reference_min_percent, reference_max_percent }`.
    Wording: "Fee appears higher than the reference range; review recommended." Never "fraud".
- [ ] `rules/accessibility-score.ts`, version it as `"v1"`. Starting weights from the proposal:

  | Factor                 | Weight |
  | ---------------------- | ------ |
  | bank_availability      | 0.20   |
  | atm_access             | 0.10   |
  | wallet_acceptance      | 0.20   |
  | cash_availability      | 0.15   |
  | merchant_acceptance    | 0.15   |
  | connectivity           | 0.10   |
  | cash_out_affordability | 0.10 (from your fee calculation) |

  Status points: `available` 1.0, `limited` 0.5, `unavailable` 0, `unknown` your choice (e.g. 0.25), but
  **write it down** in the file and the UI. The proposal scores **per route**. A simple approach: use only the
  factors that matter for that route (its `requires` + merchant_acceptance + connectivity +
  cash_out_affordability) and rescale their weights to sum to 1. Return the breakdown in `factors`.
- [ ] `rules/route-eligibility.ts`:
  - `block`: route `unsupported`, or any `requires` factor is `unavailable`
  - `review`: route `unverified`, any `requires` factor `unknown`, or any warning flag
  - `pass`: everything else
  - add a `critical` flag `REQUIRED_ACCESS_UNAVAILABLE` for blocks (see the sample)
- [ ] Unit tests for all three files with the sample request. These are quick to write and the most valuable
  tests in the project.

### Day 2 (8 Nov): the module

- [ ] `modules/finance/finance.service.ts`:
  1. assess every route with the rules
  2. recommend: among `pass` routes, highest `usable_value`, tie-break on score. If none pass → `null`
  3. **one** LLM call for the explanation, giving it the computed results:

     ```ts
     const { explanation } = await llm.generateJson({
       system: EXPLANATION_PROMPT,      // "Explain in 2–4 plain sentences. Use only the numbers given."
       user: JSON.stringify({ routes: assessments, recommended }),
       schema: z.object({ explanation: z.string() }),
     });
     ```

  4. if the LLM call fails, fall back to a template explanation built in code, so the endpoint still works
- [ ] Wire the route:

  ```ts
  financeRouter.post("/evaluate", validateBody(FinanceRequestSchema), async (req, res) => {
    res.json(await evaluateRoutes(req.body, llm));
  });
  ```

- [ ] `modules/finance/route-catalogue.ts`: 3–5 synthetic demo routes (like the sample) that the Orchestrator
  will use. Mark fees as `illustrative` unless confirmed.
- [ ] Service tests with a fake LLM: `{ generateJson: async <T>() => ({ explanation: "test" }) as T }`.

### Day 3 (9 Nov): UI

- [ ] `apps/web/app/finance/page.tsx` (Tailwind), using `api.evaluateFinance` with the sample request:
  - one card per route: name, fee, usable value, score bar, verdict badge (pass green / review amber / block red)
  - flags shown with their evidence ("20% vs reference 3–6%")
  - every amount labelled **estimate / confirmed / illustrative**
  - recommended route highlighted, plus the explanation
  - optional: route comparison in AG Grid (already installed: `ag-grid-react`)
- [ ] Open a PR into `main` by the end of the day.

### Day 4 (10 Nov): integration

- [ ] Merge `main`, help Member 1 plug your service into the Orchestrator
- [ ] Save `FinancialAssessment` rows with `getPrisma()` from `src/database/prisma.ts`
- [ ] Help build the dashboard (`apps/web/app/dashboard/`)

### Days 5–6 (11–12 Nov): together

Deployment, demo video, submission before **12:00 PT on 12 Nov**.

### Stretch (only if everything above works)

RAG over a small set of payment-policy notes (e.g. "Payouts not supported in corridor X"), retrieved and
passed into the explanation prompt. Keep it in your module folder.

## 6. Definition of done

- [ ] Sample request → bank `block`, agent `review` with fee flag, PayPal `pass` and recommended, €285 usable
- [ ] All rules unit-tested; same input always gives the same output
- [ ] A blocked or unsupported route is never recommended
- [ ] Endpoint still answers if the LLM is down (template explanation)
- [ ] Finance page shows routes, scores, flags and labels
- [ ] `npm run typecheck` and `npm test` pass

## 7. Rules

- The score explains. It never denies aid or lowers anyone's priority.
- Unknown is never treated as available.
- Never suggest workarounds to restrictions, KYC or sanctions.
- All money maths goes through `utils/money.ts`.
- Need a new npm package? Small PR to `main` first (it changes `package-lock.json`).

## 8. Who depends on you

| Who      | Needs                                          | When    |
| -------- | ---------------------------------------------- | ------- |
| Member 3 | `usable_value` of the recommended route as basket budget | Sample now, real on 10 Nov |
| Member 1 | `route-catalogue.ts` + `evaluateRoutes()` for the Orchestrator | 10 Nov |
