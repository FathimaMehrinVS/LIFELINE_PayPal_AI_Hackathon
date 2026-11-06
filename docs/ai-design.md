# AI design

## Providers

| Use                  | Provider                     |
| -------------------- | ---------------------------- |
| Main LLM calls       | Groq (free tier)             |
| Fallback             | Gemini (free tier)           |
| Scores, fees, totals | TypeScript in `src/rules/`   |

Both providers are called through their OpenAI-compatible APIs from one client, `apps/api/src/ai/llm-client.ts`.
`LLM_PROVIDER` picks the primary; on a rate limit, timeout or invalid reply the other is tried.
Model names are set in `.env` (`GROQ_MODEL`, `GEMINI_MODEL`). Check each console for current models and limits.

## Staying inside free-tier limits

- About **one LLM call per module per request**. The specialist agents are steps in code that share one call's
  structured result.
- Never call an LLM in a loop over products or routes. Send the list in one prompt.
- Cache results for the demo scenario.
- Tests never call a real LLM.

## Agents per module

### Member 1: Situation Intelligence
- **Situation Agent** (LLM): extracts needs, budget, currency, location, urgency, access factors and missing
  information from the message. Unstated facts are `"unknown"` / `null`.
- **Orchestrator** (code): chains the modules and assembles the case summary. It is not a financial authority.

AI concepts: prompt engineering, structured output, entity extraction, classification, hallucination handling.

### Member 2: Financial Intelligence
- **Financial Route Agent** (code + LLM): filters routes by eligibility and required access. Never assumes PayPal
  works everywhere.
- **Accessibility Agent** (code): 0–100 score per route from the access factors, versioned weights.
- **Cost & Anomaly Agent** (code): fees, usable value, flags against a visible reference range.
- **Risk & Compliance Agent** (code): pass / review / block. Never suggests workarounds to restrictions.
- One LLM call writes the plain-language `explanation` from the computed results.

AI concepts: explainable AI, anomaly detection, classification, rule-based guardrails, optionally RAG over
payment policies.

### Member 3: Commerce Intelligence
- **Commerce Ranking Agent** (one structured LLM call): ranks candidate products from the local synthetic
  registry and optional Channel3 results, returning product IDs and brief reasons. If the model fails, deterministic
  ordering is used.
- **Basket rules** (`rules/basket.ts`, code): assign quantities, choose items within the spend limit, calculate
  totals and reserve, choose cheaper candidates when needed, and report alternatives and unmet needs. The model
  cannot author prices or arithmetic.
- **PayPal donor checkout** (code): creates a Sandbox order and approval URL. The backend records a donation as
  captured only after PayPal confirms the capture.

AI concepts: semantic search, ranking, recommendation, budget optimisation, tool calling.

## Prompt rules

1. State the exact JSON shape and allowed enum values in the system prompt.
2. "If the message does not say it, use `unknown` or `null`. Do not guess."
3. Never ask the LLM to calculate money. Give it computed numbers to explain.
4. Keep prompts in the module folder (`modules/<module>/prompts.ts`) so they can be reviewed.
5. Every reply goes through the contract schema; invalid replies are rejected, not repaired silently.
