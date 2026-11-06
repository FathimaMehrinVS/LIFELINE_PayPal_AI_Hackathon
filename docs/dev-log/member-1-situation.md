# Dev log: Member 1, Situation Intelligence

What I built, the decisions behind it, and every problem we hit along the way. Updated after each step.

---

## Day 1 · 6 Nov 2026

### What I built

| Step | File | What it does |
| ---- | ---- | ------------ |
| 1 | branch `feature/situation-agent` | Already created from `main`; switched to it and synced with GitHub |
| 2 | `.env` (not in git) | Groq key + `GROQ_MODEL=openai/gpt-oss-120b` |
| 3 | `apps/api/src/modules/situation/prompts.ts` | System prompt: role, output shape, never-guess rules, urgency, two examples |
| 4 | `apps/api/src/rules/situation-checks.ts` | Plain code that fixes the model's draft: form fallbacks, rebuilt `missing_information`, no duplicate needs |
| 5 | `apps/api/src/modules/situation/situation.service.ts` | `analyzeSituation(input, llm)`: one LLM call, then the checks |
| 5 | `apps/api/src/routes/situation.routes.ts` | `POST /api/situation/analyze` |
| — | `tests/situation/*.test.ts` | 9 tests, all run without network |

**Checkpoint met:** the sample message returns a real `SituationResult` from Groq, with the right unknowns.

### How a request flows

```
POST /api/situation/analyze
  → validateBody      wrong input → 400, before spending any Groq credits
  → analyzeSituation
      → llm.generateJson(prompt + message)   Groq, Gemini fallback, reply checked against the schema
      → applySituationChecks                 code guarantees nothing unknown is hidden
  → JSON response
```

### Decisions and why

| Decision | Why |
| -------- | --- |
| Node.js / TypeScript, not Python | Frontend is TypeScript anyway; one shared contract from browser to LLM output; our AI is API calls, not model training |
| `openai/gpt-oss-120b` | Strongest text model on our Groq key; large models follow "never guess" much better than small ones |
| `temperature: 0` | Extraction, not creative writing: same message → same answer |
| `missing_information` built in code, not by the LLM | The model forgets fields and invents names; code can't |
| `llm` passed into `analyzeSituation` | Tests use a fake LLM, so they're free, fast and never rate-limited |
| Form hints only fill gaps | The message is the main input; the model's value wins when both exist |

### Challenges

#### 1. Groq model returned 404
- **Problem:** `llama-3.3-70b-versatile` (recommended on Groq's docs page) gave `HTTP 404`.
- **Cause:** Groq has retired the Llama 3.x models; the docs page was out of date.
- **Fix:** asked the API directly (`GET /openai/v1/models`) which models the key can use; switched to `openai/gpt-oss-120b`.
- **Lesson:** trust the live API over documentation. Told the team to use the same model.

#### 2. The model confused "my money" with "cash availability" (fixed in two rounds)
- **Problem:** "no money left" → `cash_availability: unavailable`; "can pay 2000 rupees" → `available`. Both are guesses.
- **Cause:** the prompt named the six access fields but never defined them, so the model guessed what they meant.
- **Fix 1:** added a one-line definition per access field and "the sender's budget says nothing about access". Fixed 2 of 3 cases.
- **Still failing:** "Ente veettil food illa, 3000 rs undu" (sender *is* the recipient) → cash `available`.
- **Fix 2:** "Having money, or having no money, is the budget … even when the sender and the recipient are the same
  person. Set `cash_availability` only from what the message says about getting cash locally."
- **Control test:** "Cash agents are closed, ATMs empty" still gives `cash: unavailable`, so the rule didn't break the
  normal case.
- **Lessons:**
  - A field name is not a definition. Define every field the model fills in.
  - Say where a value *may* come from, not only what it must not do.
  - After every "don't" rule, test that the model still does the right thing when it should (a control case).
  - Why it matters: Member 2 would otherwise recommend a cash-agent route nobody confirmed exists.

#### 3. Groq rate limit (HTTP 429)
- **Problem:** after 4–5 quick requests, Groq returned `429` and our API answered `502 UPSTREAM_ERROR`.
- **Cause:** the free plan limits tokens per minute, and every call sends the full prompt (~1,500 tokens).
- **Fix for now:** space out tests. **Before Day 4:** add `GEMINI_API_KEY` + `GEMINI_MODEL`, so the client falls back
  automatically during the demo.
- **Good sign:** the API didn't crash. The shared client turned the 429 into a clean `502` error.

#### 4. A shared test would have caused merge conflicts
- **Problem:** `tests/integration/api.test.ts` expected every module to return `501 NOT_IMPLEMENTED`, so it failed as
  soon as my route worked. If all three of us deleted our own line from that list, git would see edits on neighbouring
  lines and report a conflict.
- **Fix:** changed the test to "the sample passes validation" (not `400`), which stays true before and after each
  module is built. Copied only that file to `main` (`git checkout <commit> -- <file>`) so teammates get it too.
- **Lesson:** design shared tests so nobody has to edit them as features land.

#### 5. Postman import
- Pasting a file path into the Import box → "Incorrect format". The box wants the JSON itself, not a path.
- The file picker showed only squares: a font bug in the Snap version of Postman on Ubuntu, not a language problem.
- **Fix:** opened the JSON in VS Code, Ctrl+A, Ctrl+C, pasted into Postman's Import box.
- Permanent fix if needed: `rm -rf ~/snap/postman/common/.cache/fontconfig && fc-cache -f`.

#### 6. Small things
- The shared sample `situation-result.json` lists `"local_merchant_availability"`, which isn't a real field. My checks
  now drop invented names; the sample needs a small shared PR.
- Kerala test: "Shops take UPI" set wallet `available` but left `merchant_acceptance` `unknown`. Re-check on Day 2.
- "no money left" gives `budget: 0` (said) rather than `null` (not said). Kept: the Orchestrator stops on the missing
  currency anyway.

### Git, learned on the way

| Command | What it does |
| ------- | ------------ |
| `git checkout feature/situation-agent` | Switch to my branch |
| `git pull` | Bring my branch up to date from GitHub |
| `git commit` | Save a snapshot **on my computer only** |
| `git push` | Upload my commits to **my branch** on GitHub (safe; doesn't touch `main`) |
| `git merge origin/main` | Bring teammates' merged work into my branch |
| `git checkout <commit> -- <file>` | Copy one file from a commit, nothing else |

- Merge pull requests with **"Create a merge commit"**, not "Squash", so every commit keeps its author.
- Commits link to my GitHub profile through my email (`git config user.email`), which must be verified on GitHub.

### Test messages used (become Day 2 fixtures)

| # | Message | Result after fixes |
| - | ------- | ------------------ |
| 1 | Proposal: parents, bank inaccessible, internet intermittent, €300, food + medicine | ✅ |
| 2 | "we need water urgently, no money left, phone network is down" | ✅ |
| 3 | "Bank works but ATMs are empty. Need rice and baby formula, I have 150 euros" | ✅ |
| 4 | "plz help my amma needs medicin, shops r open, can pay 2000 rupees" | ✅ |
| 5 | "Ente veettil food illa, 3000 rs undu, bank closed aanu" | ✅ after fix 2 |
| 6 | "help" + form location Gaza + currency USD | ✅ no guessing from the place name |
| 7 | empty message | ✅ 400, Groq never called |
| 8 | "Cash agents in our town are closed and ATMs are empty…" (control) | ✅ |

---

## Day 2 tasks (started early, 6 Nov afternoon)

### What I built

| File | What it does |
| ---- | ------------ |
| `tests/situation/fixtures.ts` | 12 test messages, each with what a correct answer must contain |
| `tests/situation/score.ts` | Compares a result with a fixture; counts hallucinated access factors |
| `tests/situation/evaluate.ts` | Runs all fixtures against the real LLM, 8 s apart, and prints a score table |
| `tests/situation/fixtures.test.ts` | Checks the fixtures and the scoring without network |
| `apps/api/src/modules/situation/README.md` | Results table: evidence for judges |

### How the evaluation works
- Each fixture lists only the access factors the message **does** mention. Every other factor must be `unknown`.
- A factor the message didn't mention but the model filled in = **hallucinated**. That is the number that matters most.
- Run by hand, not in `npm test`, because it costs Groq credits:
  `npx tsx --env-file=.env tests/situation/evaluate.ts`

### Results

| Prompt | Model | Fully correct | Field checks | Hallucinated |
| ------ | ----- | ------------- | ------------ | ------------ |
| v2 (Day 1 end) | gpt-oss-120b | 10/12 | 97.5% | 1/59 |
| v3 | gpt-oss-120b | 12/12 | 100% | 0/59 |
| v3 | gpt-oss-20b | 12/12 | 100% | 0/59 |

### Challenges

#### 7. "ATMs are empty" was read as "limited" and spread to cash
- **Problem:** `atm_access: limited` (should be `unavailable`) and `cash_availability: limited` (never stated).
- **Cause:** "empty" wasn't in the word list, and the model chained a reasonable-sounding inference: empty ATMs → cash
  is probably scarce.
- **Fix:** added "ATMs are empty / ATM is broken / out of cash" to the `unavailable` examples, and "Each statement sets
  only the key it is about."
- **Lesson:** models don't only guess from nothing; they also **chain inferences** from one real fact to a field nobody
  mentioned. Block that explicitly.
- **Interesting:** this case passed on Day 1 with v1. Fixing the cash rule shifted behaviour elsewhere. That's why the
  whole set is re-run after every prompt change, not only the case being fixed.

#### 8. The fixture test run found the Day 1 UPI issue was already fixed
- "Shops take UPI" now sets `merchant_acceptance: available`: a side effect of defining each access key in v2.

#### 9. Small model scored the same as the big one
- `gpt-oss-20b` also scored 12/12, and was faster.
- **Lesson:** a clear prompt with definitions and examples matters more than model size for structured extraction.
- **Decision:** keep `gpt-oss-120b` for messier real messages; switch to 20b if rate limits hurt the demo.

### Situation page (`apps/web/app/situation/`)

| File | What it does |
| ---- | ------------ |
| `page.tsx` | Form (message, optional location and currency, example buttons), loading and error states |
| `situation-result.tsx` | Shows one result: urgency badge, confidence, summary, needs, budget, location, six access cards, "We still need to know". Reused by the dashboard on Day 3 |

Design choices:
- **Unknown looks different:** grey, dashed border, "Unknown — not stated". Red means the message said it doesn't
  work. Never mix the two up: that's the whole point of the module.
- **Missing fields become questions** ("Is there a working ATM they can reach?"), so the next step for the user is clear.
- **Friendly errors:** 400 → "describe the situation", 502 → "AI busy, try again in a minute", no connection →
  "is the API running?".
- Currency box only accepts letters and turns them into a 3-letter uppercase code, so the request always passes validation.
- Checked visually with headless Chrome driven by the DevTools protocol: fill the form, click Analyse, screenshot.

#### 11. Small UI catch
- The Currency box's placeholder "EUR" looked like a filled-in value in the screenshot. Changed to "3-letter code".
- **Lesson:** look at the page, don't only trust the build. Screenshots catch things tests can't.

#### 12. The form's location was thrown away
- **Found by:** testing the page myself. Message "My family in Kerala…" + Location box "ernakulam" → result "Kerala".
- **Cause:** our Day 1 rule said "the message wins, the form only fills gaps". Here that lost the more precise answer.
- **Why it matters:** Member 3 searches for shops near the family. "Kerala" is a whole state; "Ernakulam" is a district.
  And a person who types an answer and sees it ignored stops trusting the tool.
- **Fix, in two layers (AI suggests, code guarantees):**
  - prompt: combine hint + message from most to least specific → "Ernakulam, Kerala"; write names with capitals
  - `situation-checks.ts`: if the model's location doesn't contain the form's value, put the form's value in front.
    The person's typed location can never be lost.
- **Conflict case found while testing the fix:** form "Nairobi" + message "Kerala" → location "Nairobi", but the
  summary still said "Family in Kerala" and nobody would notice the mismatch. Now the summary ends with "The message
  mentions Kerala, which does not match the location given; please confirm."
- **Currency left as it was on purpose:** the amount ("€300") and its currency belong together, so a different
  currency in the form must not silently relabel the amount.
- **Evaluation:** new fixture `form-location-more-specific`; 13/13, 0/65 hallucinated.
- **Lessons:**
  - A rule that sounds right ("the message is the main input") can be wrong for a specific field. Real use finds it.
  - When fixing one case, try the opposite case too (here: places that don't fit together).

#### 10. Slow calls during evaluation (7–32 s)
- Free-plan rate limit again. The script waits 30 s and retries once, so the run still finished. Each full run takes
  about 2–3 minutes.

---

## Day 3 tasks (started early, 6 Nov evening)

### Where the team was when I started
- Member 2 (`feature/financial-intelligence`): fee, score and eligibility rules pushed; no `evaluateRoutes()` yet.
- Member 3 (`feature/commerce-payments`): nothing pushed yet, so their work is only on their laptop.
- Supabase: not created yet, `DATABASE_URL` empty.

### Step A: the Orchestrator (`apps/api/src/orchestration/`)

| File | What it does |
| ---- | ------------ |
| `run-case.ts` | `runCase(caseId, input, modules)`: Situation → Finance → Commerce, stopping honestly |
| `modules.ts` | Connects the real modules. Situation is real; Finance and Commerce are "not merged yet" placeholders |
| `tests/situation/run-case.test.ts` | 6 tests with fake modules built from the shared sample files |

How it decides:
1. Situation Agent → if budget, currency or location is missing → `needs_information` with **all** of them at once
2. Finance with the route catalogue → recommended route?
3. No route passes:
   - a verified route is on review **only** because access it needs is `unknown` → `needs_information` (ask!)
   - otherwise → `no_usable_route`
4. Commerce with `budget = usable_value` of the recommended route (€285, not the €300 sent) → `complete`

### Challenges

#### 13. The demo would have stopped at the payment step
- **Found by:** walking through Priya's case end to end on paper.
- **Problem:** her first message leaves `wallet_acceptance: unknown`. Member 2's rule says "a required access factor
  is unknown → review", so the PayPal route can't pass, and the case would end as `no_usable_route`: **the money
  never moves** in the demo.
- **Why the samples hid it:** Member 2's sample input already had wallet `available`, so each module looked fine on
  its own. Only following one case through all three modules showed the gap.
- **Fix:** `unknownsBlockingRoutes()`. If a route is verified, has no warning flag, and is on review only because of
  unknown access, the Orchestrator returns `needs_information` with those factors. The person answers, the case runs
  again, and the PayPal route passes.
- **No change needed in Member 2's code:** the Orchestrator already knows each route's `requires` list, because it
  passes the route catalogue in.
- **Lessons:**
  - Modules that each pass their own tests can still fail together. Walk one real case through everything.
  - "Unknown" should lead to a question, not a dead end.

#### 14. Building against modules that don't exist yet
- **Problem:** the Orchestrator calls `evaluateRoutes()` and `buildBasket()`, which aren't written or merged yet.
  Importing them would break the build.
- **Fix:** the Orchestrator takes a `CaseModules` object. Tests pass fakes; `modules.ts` holds placeholders that
  answer "not merged yet". On merge day only `modules.ts` changes: one import and one line per teammate function.
- **Lesson:** depend on the contract (the shapes in `packages/contracts`), not on someone else's file. This is
  called dependency injection.

#### 15. Scope check: are we drifting from the idea?
- Discussed voice input and many disaster use cases. Decision: **no**. LIFELINE is a payment-routing product; the
  crisis is only why normal banking failed. Voice dropped for the hackathon (maybe "future work"). Everything left
  for Member 1 is about getting the payment flow to work in the demo.
- Also: voice can't help when the family has no internet; that's why the users are the sender abroad and NGO workers.
