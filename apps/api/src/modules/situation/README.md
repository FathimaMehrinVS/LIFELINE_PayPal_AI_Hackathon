# Situation Intelligence — Member 1 (`feature/situation-agent`)

Agents: **Situation Agent** and **Orchestrator**.

Input `SituationRequest` → output `SituationResult` (`packages/contracts/src/situation.ts`):
summary, needs, budget, currency, location, urgency, access factors, missing information, confidence.

- Build the prompt in `prompts.ts` and call the shared client in `src/ai/llm-client.ts`.
- Anything the message doesn't state stays `"unknown"` / `null` and goes into `missing_information`.
- Replace the `notImplemented` handler in `src/routes/situation.routes.ts`.
- Frontend: `apps/web/app/situation/`. Tests: `tests/situation/`.
- At integration time the Orchestrator in `src/orchestration/` chains Situation → Financial → Commerce.
