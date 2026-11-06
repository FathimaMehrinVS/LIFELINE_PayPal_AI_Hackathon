# Handoff: Member 1, Situation Intelligence

**Branch:** `feature/situation-agent` · **Effort:** ~25 hours over 4 days

| Part              | What you build                                                  |
| ----------------- | --------------------------------------------------------------- |
| AI                | **Situation Agent**: emergency message → structured JSON        |
| Rules (no AI)     | Unknown / missing-information checks                            |
| External service  | Groq + Gemini fallback, **Render** deployment                    |
| Frontend          | Situation page + **AG Grid dashboard** with the Approve button  |
| Final-day job     | **Orchestrator** (chains all three modules), demo video         |

**You will learn:** prompt engineering, structured output, entity extraction, classification, hallucination
handling, agent orchestration, deployment.

---

## 1. Setup (30 min)

```bash
git clone https://github.com/FathimaMehrinVS/LIFELINE_PayPal_AI_Hackathon.git
cd LIFELINE_PayPal_AI_Hackathon
git checkout feature/situation-agent
npm install
cp .env.example .env
npm test
```

In `.env`, use **your own** Groq key (each member has their own, so rate limits don't collide):

- `GROQ_API_KEY`: console.groq.com → API Keys
- `GROQ_MODEL`: a current model from console.groq.com/docs/models that supports JSON mode
- optional fallback: `GEMINI_API_KEY` + `GEMINI_MODEL` (aistudio.google.com)
- `DATABASE_URL`, `DIRECT_URL`: Member 3 shares these on Day 1

`npm run dev:api` → `http://localhost:4000/health`

## 2. Files you own (only these)

| Path                                         | What goes there                             |
| -------------------------------------------- | ------------------------------------------- |
| `apps/api/src/modules/situation/`            | `prompts.ts`, `situation.service.ts`        |
| `apps/api/src/rules/situation-checks.ts`     | Unknown / missing-information checks        |
| `apps/api/src/routes/situation.routes.ts`    | `POST /api/situation/analyze`               |
| `apps/api/src/orchestration/`                | `run-case.ts` (Day 3)                       |
| `apps/api/src/routes/cases.routes.ts`        | `POST /api/cases`, `GET /api/cases` (Day 3) |
| `apps/web/app/situation/`                    | Situation page                              |
| `apps/web/app/dashboard/`                    | AG Grid dashboard + Approve button          |
| `tests/situation/`                           | Your tests                                  |
| `render.yaml`                                | Deployment (Day 4)                          |

Everything else belongs to someone else or is frozen. If you really need a shared change (contracts, AI client,
schema, a new npm package), open a small PR to `main` and tell the team first.

## 3. Your contracts

| Endpoint                     | Input                                  | Output                                 |
| ---------------------------- | -------------------------------------- | -------------------------------------- |
| `POST /api/situation/analyze`| `SituationRequest` (`samples/situation-request.json`) | `SituationResult` (`samples/situation-result.json`) |
| `POST /api/cases`            | `SituationRequest`                     | `CaseResult` (`packages/contracts/src/case.ts`) |

Member 2 uses your `access` object; Member 3 uses `needs`, `budget`, `currency`, `location`. Your output starts the
whole pipeline, so **getting unknowns right matters more than anything else**.

---

## 4. Day-by-day

### Day 1 · 6 Nov · extraction works (~6 h)

- [ ] **`modules/situation/prompts.ts`** (1.5 h): system prompt with
  - the exact JSON shape and every allowed enum value (needs, urgency, availability)
  - "If the message does not state it, use `unknown` or `null`. Never guess."
  - urgency guidance (medicine or children at risk → `high`; life-threatening → `critical`)
  - two short examples: one complete message, one vague one
- [ ] **`modules/situation/situation.service.ts`** (1 h)

  ```ts
  import { type SituationRequest, type SituationResult, SituationResultSchema } from "@lifeline/contracts";
  import type { LlmClient } from "../../ai/llm-client";
  import { applySituationChecks } from "../../rules/situation-checks";
  import { SITUATION_SYSTEM_PROMPT } from "./prompts";

  export async function analyzeSituation(input: SituationRequest, llm: LlmClient): Promise<SituationResult> {
    const raw = await llm.generateJson({
      system: SITUATION_SYSTEM_PROMPT,
      user: JSON.stringify(input),
      schema: SituationResultSchema,
    });
    return applySituationChecks(raw, input);
  }
  ```

- [ ] **`rules/situation-checks.ts`** (1.5 h), plain code, your deterministic guarantee:
  - if the request gave `currency` / `location` and the model returned `null`, use the request value
  - every access factor that is `unknown`, and every `null` field, appears in `missing_information`
  - de-duplicate `needs` and `missing_information`
- [ ] **Wire the route** (0.5 h)

  ```ts
  situationRouter.post("/analyze", validateBody(SituationRequestSchema), async (req, res) => {
    res.json(await analyzeSituation(req.body, llm));
  });
  ```

- [ ] Try 3–4 messages in Postman (`postman/` → Situation) (1 h)

**Checkpoint tonight:** the sample message returns real `SituationResult` JSON from Groq.

### Day 2 · 7 Nov · reliable + visible (~6 h)

- [ ] **Test set** `tests/situation/fixtures.ts` (1.5 h), 8–10 messages:
  - the €300 proposal message
  - "My family in Kerala needs food and medicine, budget 5000 INR"
  - no budget → `budget: null` and `"budget"` in missing info
  - no bank mentioned → `bank_availability: "unknown"` (the hallucination check)
  - very vague ("please help us"), typos, mixed language
- [ ] **Unit tests** with a fake LLM, no network (1.5 h)

  ```ts
  const fakeLlm: LlmClient = { generateJson: async <T>() => sampleResult as T };
  ```

  Test `situation-checks.ts` thoroughly.
- [ ] **Evaluate** the real fixtures once against Groq; fix the prompt; write the results table in
  `modules/situation/README.md` (judges like evidence) (1 h)
- [ ] **Situation page** `apps/web/app/situation/page.tsx` (2 h): textarea + Analyse button, summary card, need
  chips, urgency badge, access grid (unknown in grey, clearly marked), "We still need to know" list, loading and
  error states. Use `api.analyzeSituation` from `apps/web/services/api.ts`.

**Evening:** open your PR into `main`; review one teammate's PR (10 min).

### Day 3 · 8 Nov · Orchestrator + dashboard (~7 h)

Merge `main` into your branch first (it now has Member 2's and 3's modules).

- [ ] **`orchestration/run-case.ts`** (2 h)
  1. `analyzeSituation(...)`
  2. if `budget` or `currency` is missing → stop, return `status: "needs_information"`
  3. `evaluateRoutes(...)` with your `access`, the budget, and Member 2's `route-catalogue.ts`
  4. if no recommended route:
     - a verified route is on `review` only because access it needs is `unknown` (no warning flags) → stop with
       `status: "needs_information"` and those factors, so the person is asked instead of the case dying
     - otherwise → stop, `status: "no_usable_route"`
  5. `buildBasket(...)` with `budget = usable_value` of the recommended route
  6. return `CaseResult` with `status: "complete"`. Never invent a missing value.
- [ ] **`routes/cases.routes.ts`** (1 h): `POST /api/cases` runs the case and saves an `AssistanceRequest` +
  `SituationAssessment` with `getPrisma()`; `GET /api/cases` lists them for the dashboard
- [ ] **Dashboard** `apps/web/app/dashboard/page.tsx` (3 h): AG Grid Community (`ag-grid-react`, already
  installed) with one row per case: urgency, needs, recommended route, usable value, basket total, allocation and
  payout status. Add an **Approve** button per row that calls Member 2's `POST /api/allocations/approve`.
- [ ] Full run on your machine, from message to dashboard to approval (1 h)

**Checkpoint tonight:** the whole demo works end to end on one machine.

### Day 4 · 9 Nov · ship (~6 h)

- [ ] **Render** (2 h): create the Blueprint from `render.yaml`, set the secrets in the dashboard, set
  `WEB_ORIGIN` / `NEXT_PUBLIC_API_URL` to the Render URLs, check `/health`
- [ ] **Demo script** (1 h), under 3 minutes: problem → message → situation → routes → basket → donate (PayPal
  Sandbox) → approve → payout → dashboard
- [ ] **Record the video** (2 h) and upload it to YouTube (public)
- [ ] **Devpost write-up** with the team (1 h), then submit

---

## 5. Definition of done

- [ ] The sample message gives a valid `SituationResult` from the real API, with one LLM call
- [ ] Unstated facts are always `unknown` / `null` and listed in `missing_information`
- [ ] Checks and service are unit-tested without network
- [ ] `/api/cases` chains all three modules and stops honestly when data is missing
- [ ] Dashboard shows cases and the Approve button works
- [ ] Deployed on Render (or a clean local setup) and the video is uploaded

## 6. If you fall behind, cut in this order

1. Dashboard → a plain HTML table instead of AG Grid
2. Saving cases to the database → keep them in memory
3. Render → demo from a local setup (the rules allow it)

## 7. Rules

- The LLM extracts and classifies. It never calculates money.
- Use only the shared `llm` client in `src/ai/`.
- Synthetic data only, never real people or places.

## 8. Handover points

| You give                               | To       | When      |
| -------------------------------------- | -------- | --------- |
| `analyzeSituation()`                   | Orchestrator (you) | Day 2 |
| `/api/cases` + dashboard               | Everyone (demo)    | Day 3 |
| Live URL + video                       | Submission         | Day 4 |

| You need                                | From     | When  |
| --------------------------------------- | -------- | ----- |
| `evaluateRoutes()` + `route-catalogue.ts` | Member 2 | Day 2 evening (merged) |
| `buildBasket()`                         | Member 3 | Day 2 evening (merged) |
| `POST /api/allocations/approve`         | Member 2 | Day 3 |
