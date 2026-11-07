# Integration status

Owner: Member 2 (completed on Day 4). Required by the submission rules: say plainly what is real, what was tested
in a sandbox, and what is simulated.

| Integration                    | Status        | Notes |
| ------------------------------ | ------------- | ----- |
| Groq (Gemini fallback)         | not built yet |       |
| Supabase PostgreSQL            | not built yet |       |
| FinanceAssessment persistence  | implemented; not externally verified | Prisma upsert helper is ready; the case flow still needs to create an `AssistanceRequest` row first. No database write has been manually tested. |
| Channel3 product search        | implemented; not externally verified | Server-side search adapter and local registry fallback are implemented; credentials/API response not manually tested. |
| PayPal Orders (donor checkout) | implemented; Sandbox flow not verified | Shared OAuth client and create/approve/capture code are implemented; no live Sandbox checkout or database capture test has been run. |
| PayPal donation webhooks       | implemented; not externally verified | Signature verification and idempotent donation event handling are mocked in tests; Sandbox registration and live delivery wait until deployment and `PAYPAL_WEBHOOK_ID` setup. |
| PayPal Payouts                 | not built yet | Real sandbox or simulated, depending on the Day 1 check |
| Render deployment              | not built yet |       |

Status values: **real** · **sandbox-tested** · **simulated** · **implemented; not externally verified** · **not built**.

## Known limitations

- All demo data (recipients, merchants, locations, fees) is synthetic.
- Finance assessment persistence is not end-to-end until the Orchestrator creates database-backed assistance requests.
