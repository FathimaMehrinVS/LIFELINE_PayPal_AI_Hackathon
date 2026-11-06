# Situation Agent — Member 1 (`feature/situation-agent`)

Turns a free-text message into a structured `SituationResult` (see `packages/contracts/src/situation.ts`):
needs, budget, urgency, missing information and confidence.

Implementation (prompts, Groq calls, output validation) goes in this folder.
Wire it into `src/routes/situation.routes.ts` in place of the `notImplemented` handler.
