# Tests

| Folder         | Owner    |
| -------------- | -------- |
| `situation/`   | Member 1 |
| `finance/`     | Member 2 |
| `commerce/`    | Member 3 |
| `contracts/`   | Shared — samples must always match the contracts |
| `ai/`          | Shared — LLM client |
| `paypal/`      | Shared PayPal client and Member 3 Orders/donation-route tests |
| `integration/` | Shared API-level route mounting and contract validation |

Tests never call real LLMs, Channel3, PayPal or PostgreSQL. Mock `fetch` or pass fake clients/route dependencies.
Commerce tests cover deterministic basket arithmetic, budget and reserve, alternatives, unmet needs, source fallback,
LLM failure handling and API validation. Run the complete suite from the repository root with `npm test`.
