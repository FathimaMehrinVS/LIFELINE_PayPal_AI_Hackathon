# Integration status

Required by the submission rules: say plainly what is real, what was tested in a sandbox, and what is simulated.
Last checked: 9 Nov 2026.

| Integration | Status | Notes |
| --- | --- | --- |
| Groq | real | Runs situation analysis and explanations. A Gemini fallback is built but needs `GEMINI_API_KEY`. |
| Supabase PostgreSQL | real | Stores cases, assessments, baskets, approvals, donations, suppliers and audit records. |
| Supabase Auth | real | Email and password sign-in. The API checks each token and reads the role from the database. |
| Channel3 product search | real | Used first for product search, with a synthetic local registry as the fallback. |
| PayPal Orders (donor checkout) | implemented; capture not yet verified | Sandbox orders are created. Buyer approval currently fails with `UNSUPPORTED_PAYEE_CURRENCY` for EUR, so no capture has succeeded. |
| PayPal donation webhooks | implemented; not externally verified | Signature checks are covered by tests. Registration waits for deployment and `PAYPAL_WEBHOOK_ID`. |
| Assistance disbursement | simulated | Records `Payout.mode = SIMULATED`. No PayPal payout is sent and no transfer is claimed. |
| Purchase orders and delivery events | tables ready; flow not built yet | Donor and NGO pages show these steps as "Not yet recorded" until records exist. |
| Render deployment | not deployed yet | `render.yaml` is in the repo. |

Status values: **real** · **sandbox-tested** · **simulated** · **implemented; not externally verified** · **not built**.

## Known limitations

- Suppliers, their order history, routes and fees are synthetic and labelled in the UI.
- Situations entered for testing are invented. No real person's details are used.
- Reports and approved plans currently need a signed-in account.
- A plan's approved amount can be larger than its listed items. The difference is shown as "not yet itemised".
