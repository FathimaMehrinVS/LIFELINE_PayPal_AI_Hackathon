# Situation Intelligence — Member 1 (`feature/situation-agent`)

AI: **Situation Agent**. Also owns the Orchestrator (`src/orchestration/`), `/api/cases` and the dashboard.
Full plan: `docs/handoffs/member-1-situation.md`.

Input `SituationRequest` → output `SituationResult` (`packages/contracts/src/situation.ts`):
summary, needs, budget, currency, location, urgency, access factors, missing information, confidence.

```
POST /api/situation/analyze
  → validateBody                  wrong input → 400, no LLM call
  → analyzeSituation(input, llm)  situation.service.ts
      → one LLM call              prompts.ts, temperature 0, reply checked against the schema
      → applySituationChecks      src/rules/situation-checks.ts (no AI)
```

- The LLM extracts and classifies. It never calculates money.
- Anything the message doesn't state stays `"unknown"` / `null`.
- `missing_information` is rebuilt in code from the result, so it can't miss a field or contain an invented name.
- Frontend: `apps/web/app/situation/`. Tests: `tests/situation/`.

## Evaluation

13 test messages in `tests/situation/fixtures.ts`: the proposal message, typos, mixed Malayalam and English, form-only
hints, vague messages, and cases built to tempt the model into guessing. Every access factor a message doesn't mention
must come back `unknown`; any other value counts as a **hallucinated** factor.

Run after every prompt change (uses Groq credits, not part of `npm test`):

```bash
npx tsx --env-file=.env tests/situation/evaluate.ts
GROQ_MODEL=openai/gpt-oss-20b npx tsx --env-file=.env tests/situation/evaluate.ts   # another model
```

### Results

| Prompt version | Model | Fully correct | Field checks | Hallucinated access |
| -------------- | ----- | ------------- | ------------ | ------------------- |
| v1: access keys named, not defined | gpt-oss-120b | 4 of 8 manual tests | — | budget read as cash availability in 3 messages |
| v2: each access key defined; "budget says nothing about access" | gpt-oss-120b | 10/12 | 115/118 (97.5%) | 1/59 |
| v3: "each statement sets only the key it is about"; "ATMs are empty" → unavailable | gpt-oss-120b | **12/12** | **118/118 (100%)** | **0/59** |
| v3 | gpt-oss-20b | 12/12 | 118/118 (100%) | 0/59 |
| v4: form location combined with the message's ("Ernakulam, Kerala"); mismatches flagged in the summary | gpt-oss-120b | **13/13** | **128/128 (100%)** | **0/65** |

What each change fixed:

- **v1 → v2:** "no money left" gave `cash_availability: unavailable` and "can pay 2000 rupees" gave `available`. The
  model was reading the sender's money as local cash access. Defining every access key fixed it, and also fixed
  "shops take UPI" now setting `merchant_acceptance`.
- **v2 → v3:** "ATMs are empty" gave `atm_access: limited` and inferred `cash_availability: limited`. Mapping "empty /
  broken / out of cash" to `unavailable` and limiting each statement to its own key fixed both.
- **v3 → v4:** found by testing the page: form "ernakulam" + message "Kerala" gave just "Kerala", losing the district
  the person typed. Now the prompt combines them and `situation-checks.ts` guarantees the form's location is kept.
  If the two don't fit together (form "Nairobi", message "Kerala"), the form wins and the summary asks to confirm.
- **Control case** (`cash-agents-closed`): real statements about cash are still extracted after the "don't guess"
  rules.

The larger and smaller models score the same on this set, so the prompt matters more than model size here. We keep
`gpt-oss-120b` as the default for unseen, messier messages; `gpt-oss-20b` is faster if rate limits become a problem.
13 messages is a small set: add every new failure you find as a fixture.
