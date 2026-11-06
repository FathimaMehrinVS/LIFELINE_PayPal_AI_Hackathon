# Handoff: Member 1, Situation Intelligence

**Branch:** `feature/situation-agent`
**Agents you own:** Situation Agent, Orchestrator
**One-line job:** turn a plain-language emergency message into a structured `SituationResult`, then (at the end)
chain all three modules into one case.

---

## 1. Setup (30 min)

```bash
git clone https://github.com/FathimaMehrinVS/LIFELINE_PayPal_AI_Hackathon.git
cd LIFELINE_PayPal_AI_Hackathon
git checkout feature/situation-agent
npm install
cp .env.example .env
npm test                     # 17 tests should pass
```

In `.env`:

- `GROQ_API_KEY`: from console.groq.com → API Keys
- `GROQ_MODEL`: pick a current model from console.groq.com/docs/models that supports JSON mode
- Optional backup: `GEMINI_API_KEY` + `GEMINI_MODEL` from aistudio.google.com

Then `npm run dev:api` and open `http://localhost:4000/health`.

## 2. What you own

| Path                                        | What goes there                        |
| ------------------------------------------- | -------------------------------------- |
| `apps/api/src/modules/situation/`           | Prompt, service, post-processing       |
| `apps/api/src/routes/situation.routes.ts`   | Replace the `notImplemented` handler   |
| `apps/web/app/situation/`                   | The Situation page                     |
| `tests/situation/`                          | Your tests                             |
| `apps/api/src/orchestration/`               | Orchestrator (Day 4, after merges)     |

Don't edit other members' folders. Changes to contracts, the AI client or the schema go through a small PR to `main`.

## 3. Your contract

- **Input:** `SituationRequest`, see `packages/contracts/samples/situation-request.json`
- **Output:** `SituationResult`, see `packages/contracts/samples/situation-result.json`
- Schema: `packages/contracts/src/situation.ts`

Member 2 consumes your `access` object. Member 3 consumes your `needs`, `budget`, `currency` and `location`.
Your output is the start of the whole pipeline, so accuracy on **unknowns** matters more than anything.

## 4. Tasks

### Day 1 (7 Nov): extraction works from the terminal

- [ ] `modules/situation/prompts.ts`: system prompt. Include:
  - the exact JSON shape and every allowed enum value (needs, urgency, availability)
  - "If the message does not state it, use `unknown` or `null`. Never guess."
  - urgency guidance (e.g. medicine or children at risk → `high`; life-threatening → `critical`)
  - 2 short examples (few-shot): one complete, one vague
- [ ] `modules/situation/situation.service.ts`:

  ```ts
  import { type SituationRequest, type SituationResult, SituationResultSchema } from "@lifeline/contracts";
  import type { LlmClient } from "../../ai/llm-client";
  import { SITUATION_SYSTEM_PROMPT } from "./prompts";

  export async function analyzeSituation(input: SituationRequest, llm: LlmClient): Promise<SituationResult> {
    const raw = await llm.generateJson({
      system: SITUATION_SYSTEM_PROMPT,
      user: JSON.stringify(input),
      schema: SituationResultSchema,
    });
    return postProcess(raw, input);
  }
  ```

- [ ] `postProcess` (plain code, no AI):
  - if the request gave `currency`/`location` and the model returned `null`, use the request values
  - every access factor that is `unknown` and every `null` field (`budget`, `location`, `currency`)
    must appear in `missing_information`. Add any the model forgot.
  - de-duplicate `needs` and `missing_information`
- [ ] Try 3–4 messages by hand with a tiny script or Postman (`postman/` collection → Situation).

### Day 2 (8 Nov): reliable AI

- [ ] Wire the route:

  ```ts
  situationRouter.post("/analyze", validateBody(SituationRequestSchema), async (req, res) => {
    res.json(await analyzeSituation(req.body, llm));
  });
  ```

- [ ] Build a test set in `tests/situation/fixtures.ts`, 8–10 messages, for example:
  - the €300 proposal message
  - "My family in Kerala needs food and medicine, budget 5000 INR"
  - no budget mentioned → `budget: null`, `"budget"` in missing info
  - no bank mentioned → `bank_availability: "unknown"` (the hallucination check)
  - very short / vague ("please help")
  - mixed language or typos
- [ ] Unit tests with a **fake LLM** (no real API calls, see `tests/ai/llm-client.test.ts`):

  ```ts
  const fakeLlm: LlmClient = { generateJson: async <T>() => sampleResult as T };
  ```

  Test `postProcess` thoroughly: that's your deterministic guarantee.
- [ ] Run the real fixtures once against Groq and note which ones fail. Adjust the prompt. Keep notes in
  `modules/situation/README.md` (judges like evidence of evaluation).

### Day 3 (9 Nov): UI

- [ ] `apps/web/app/situation/page.tsx` (client component, Tailwind):
  - textarea + optional location/currency + Analyse button, using `api.analyzeSituation` from `services/api.ts`
  - summary card, needs as chips, urgency badge
  - access-factor grid with colours: available / limited / unavailable / **unknown (grey, clearly marked)**
  - "We still need to know" list from `missing_information`
  - loading and error states (show `error.message` from the API)
- [ ] Open a PR into `main` by the end of the day.

### Day 4 (10 Nov): Orchestrator + integration

After Member 2 and 3's PRs are merged, merge `main` into your branch, then:

- [ ] `orchestration/run-case.ts`: Situation → Financial → Commerce
  - build the `FinanceRequest` from your `access` + `budget` + the demo route catalogue (Member 2 provides it)
  - build the `CommerceRequest` with `budget = usable_value` of the recommended route
  - if a step can't run (no budget, no passing route), stop and return what's missing. Never invent values.
- [ ] `POST /api/cases` route returning all three results
- [ ] Save the case (`AssistanceRequest` + `SituationAssessment`) with `getPrisma()` from `src/database/prisma.ts`
- [ ] Help wire the dashboard and the end-to-end demo.

### Days 5–6 (11–12 Nov): together

Deployment on Render, README check, demo video, submission before **12:00 PT on 12 Nov**.

## 5. Definition of done

- [ ] The sample request returns a valid `SituationResult` from the real API
- [ ] Unstated facts are always `unknown` / `null` and listed in `missing_information`
- [ ] One LLM call per request
- [ ] Unit tests pass without network; `npm run typecheck` passes
- [ ] Situation page works end to end
- [ ] Orchestrator chains all three modules

## 6. Rules

- The LLM extracts and classifies. It never calculates money.
- Use only the shared `llm` client. Don't add an SDK or a second client.
- Synthetic demo data only, never real people or locations.
- Need a new npm package? It changes `package-lock.json`, so do it in a small PR to `main`.

## 7. Who depends on you

| Who      | Needs                                   | When         |
| -------- | --------------------------------------- | ------------ |
| Member 2 | `access` object shape: already frozen in the contract | Now (sample) |
| Member 3 | `needs`, `budget`, `currency`, `location` | Now (sample) |
| Everyone | Orchestrator for the end-to-end demo    | 10 Nov       |
