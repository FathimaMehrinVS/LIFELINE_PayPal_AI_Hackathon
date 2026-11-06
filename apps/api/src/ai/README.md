# Shared AI layer

One LLM client for all three modules. Do not create a second one in your module.

```ts
import { llm } from "../../ai/llm-client";
import { SituationResultSchema } from "@lifeline/contracts";

const result = await llm.generateJson({
  system: "You are the LIFELINE Situation Agent. ...",
  user: message,
  schema: SituationResultSchema,
});
```

- Providers: Groq (primary) and Gemini (fallback), both through their OpenAI-compatible APIs.
  `LLM_PROVIDER` picks the primary. If the primary hits a rate limit, times out or returns bad JSON,
  the other provider is tried when its key and model are set.
- Model names come from `GROQ_MODEL` / `GEMINI_MODEL`. Pick current models from each console;
  free-tier limits differ per model.
- Every reply is validated against the contract schema. Invalid replies never reach your module.

## Rules

1. The LLM extracts, classifies, ranks and explains. It never calculates scores, fees or totals and
   never authorises a payment. Those live in `src/rules/`.
2. Missing information stays `"unknown"` or `null`. Say so in the prompt.
3. Keep LLM calls to about one per module per request to stay inside free-tier rate limits.
   The specialist "agents" are steps in your code, not separate model calls.
4. Keep prompts in your own module folder, e.g. `modules/situation/prompts.ts`.
