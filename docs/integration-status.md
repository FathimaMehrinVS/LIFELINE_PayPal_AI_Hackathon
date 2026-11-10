# Integration status

Required by the submission rules: say plainly what is real, what was tested in a sandbox, and what is simulated.
Last checked: 10 Nov 2026.

| Integration | Status | Notes |
| --- | --- | --- |
| Groq | real | Runs situation analysis and explanations. A Gemini fallback is built but needs `GEMINI_API_KEY`. |
| Supabase PostgreSQL | real | Stores cases, assessments, baskets, approvals, donations, suppliers and audit records. Row-level security is on for every table, so the public browser key reads no rows. |
| Supabase Auth | real | Email and password sign-in. The API checks each token and reads the role from the database. |
| Channel3 product search | real | Used first for product search, with a synthetic local registry as the fallback. |
| PayPal Orders (donor checkout) | sandbox-tested | A €25 EUR donation was approved by a Sandbox buyer and captured on 10 Nov. The server confirms the capture with PayPal before recording it. |
| PayPal donation webhooks | sandbox-tested | Registered for the Render API. "Order approved" and "capture completed" arrived and passed signature verification on 10 Nov. |
| Exchange rates | real | Daily European Central Bank reference rates, used only to show amounts in the viewer's currency. Plans are approved and paid in EUR. |
| Purchase orders, delivery and pickup codes | implemented; not externally verified | Built and covered by tests. An end-to-end run needs a fully funded plan. |
| Supplier payment | simulated | Recorded against the purchase order with `Payout.mode = SIMULATED`. No money is sent. |
| Render (API) and Vercel (web) | deployed | Running from `main`. |

Status values: **real** · **sandbox-tested** · **simulated** · **implemented; not externally verified** · **not built**.

## Known limitations

- Suppliers, their order history, routes and fees are synthetic and labelled in the UI.
- Situations entered for testing are invented. No real person's details are used.
- Reports and approved plans currently need a signed-in account.
- Plans can only be funded in EUR. A case reported in another currency is shown converted but can't be approved yet.
- Exchange rates are not published for every currency (for example AED), so those viewers see EUR.
