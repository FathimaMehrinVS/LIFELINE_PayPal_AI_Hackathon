# Member 1 (Athira V): cases, suppliers, dashboard, launch

Back to the [team board](README.md). Update status there, and details here.

**Your files:** `apps/api/src/orchestration/`, `modules/situation/`, `modules/commerce/`, `rules/basket.ts`,
`routes/cases.routes.ts`, new `routes/suppliers.routes.ts`, `routes/plans.routes.ts`, `apps/web/app/situation/`,
`dashboard/`, `commerce/`, new `suppliers/` and `plans/`, `prisma/`, `render.yaml`.

Commerce and donor plans moved to you. Member 3's login/profile provisioning and role-based authorization checkpoint is complete; the remaining Member 3 item is a verified PayPal Sandbox capture.

## M1-1 Database migration · 8 Nov · do this first

- Apply the "Database changes" section of the team README in one migration, then push and tell the team.
- Done when: `npx prisma migrate status` is clean and everyone has run `npx prisma migrate deploy`.

## M1-2 Fix product quality · 8 Nov

Live test: the USD basket picked a "Prepper Handbook" as food. `product-source.ts` matches a word anywhere in the text.

- Match whole words and exclude cosmetics, books, toys and storage containers.
- Let the AI mark a product as not an essential, and in `buildBasket` never pick those.
- Use Channel3 first and the local catalogue only when Channel3 has nothing suitable.
- Label each source clearly.
- Done when: "Red Bean TXA Food Mask", "Prepper Handbook", micellar water and "Baby Watering Can" are rejected, with a test.

## M1-3 Amount, household, kits, quantities · 9 Nov

- Add an optional `assistance_amount` to the case request. When set, the Orchestrator uses it as the budget, so a
  family with no money isn't stopped.
- Extract household size and special needs (for example "diabetic mother").
- Add predefined emergency kits for urgent cases, from approved suppliers.
- Set quantities by household size and days of cover.
- Done when: "2 children, no money, needs food and medicine" produces a realistic basket with no budget question.

## M1-4 Suppliers · 9 Nov · needs M1-1

- Build the supplier endpoints from the README, and a page using AG Grid: register, approve, suspend, search, compare.
- Write every status change to `AuditLog`.
- Seed labelled synthetic suppliers with order history.
- Scorecard from recorded orders only, showing the order count. Use a weighted score so one perfect order can't beat
  100 strong ones.
- Done when: a suspended supplier can't be chosen.

## M1-5 NGO-first request page · 9 Nov · needs M1-3

- Default to "I'm an NGO worker". Replace "You send" wording and add the NGO amount.
- Keep voice and tap mode. Test voice with a real microphone.

## M1-6 Dashboard · 10 Nov · needs M2-3 and M2-4

- Load approval, funding and payment state from the server, so a refresh loses nothing.
- Add AG Grid columns: Supplier, Funding, Supplier payment, Delivery, Risk.
- Add supplier selection to Approve (send `merchant_id`; stop sending `amount`).
- Add a funds view: available, committed, remaining.
- Add the case timeline from `GET /api/cases/:id/timeline`.

## M1-7 Donor plans · 10 Nov · needs M1-6

- Build `/api/plans` and a page listing approved plans. Follow "Protect the families" in the README.
- Add a progress page for each plan, showing recorded events only.

## M1-8 Deploy · 11 Nov

- Create the Render Blueprint, set the secrets and the two URLs, and check `/health`.
- Register the webhook in the PayPal Sandbox, set `PAYPAL_WEBHOOK_ID`, and test one delivery.
- Add a `GEMINI_API_KEY`, so a Groq rate limit can't stop the demo.

## M1-9 Launch · 12 Nov

- Fix the broken README link to `docs/LIFELINE_PROJECT_OVERVIEW.md`.
- Update `docs/integration-status.md` and `docs/project-overview.md` to the NGO story.
- Write the under-3-minute script, record and upload the video, and submit on Devpost with the Tools section.

**If you fall behind, cut in this order:** funds view, emergency kits, supplier comparison.
