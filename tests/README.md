# Tests

| Folder         | Owner    |
| -------------- | -------- |
| `situation/`   | Member 1 |
| `finance/`     | Member 2 |
| `commerce/`    | Member 3 |
| `contracts/`   | Shared — samples must always match the contracts |
| `ai/`          | Shared — LLM client |
| `paypal/`      | Shared — PayPal client (`client.ts`) |
| `integration/` | Shared — API-level tests; `end-to-end.test.ts` is Member 3's |

Tests never call real LLMs, Channel3 or PayPal. Mock `fetch` or pass a fake client (see `ai/llm-client.test.ts`).
Run everything with `npm test`.
