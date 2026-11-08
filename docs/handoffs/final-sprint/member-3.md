# Member 3 (Asiya Muhammed Sali): login and PayPal

Back to the [team board](README.md). Update status there, and details here.

You have the shortest list on purpose, because login is a big job. Commerce and the donor plans page have moved to
Member 1.

**Your files:** new `apps/api/src/middleware/auth.ts`, login pages in `apps/web/app/`, `integrations/paypal/`,
`routes/donation.routes.ts`, `apps/web/app/donate/`.

## M3-1 Login and roles · 9 Nov · in progress

**Already on `main`:** Supabase Auth, the login page, `GET /api/auth/me`, the `User.authUserId` link, and the roles
`NGO`, `DONOR` and `PARTNER` (`PARTNER` is our supplier role). Details are in `docs/authentication.md`.

**Still needed, and Members 1 and 2 are waiting on the first item:**

- **Backend:** a `requireRole("NGO")` middleware built on `resolveAuthenticatedSession`, setting `req.user` to
  `{ id, email, role }`. Until this exists, no feature route is protected. Roles come from the `User` table, so never
  trust a role sent by the browser.
- **API calls:** send the Supabase access token as `Authorization: Bearer <token>` from `services/api.ts`.
- **Frontend:** a way for any page to get the current user, and a sidebar that shows only that role's pages.
- **Demo accounts:** one NGO, one donor and one partner, linked to Supabase users and written in the README for the
  judges.
- **Tests:** a simple way to pass a fake user, so all tests keep passing without a real login.
- **Families never log in.**

| Access | Endpoints |
|---|---|
| Open | `/health`, sending a report, `GET /api/plans`, the PayPal webhook (it checks its own signature) |
| NGO only | Approve, suppliers, supplier payments, cases list |
| NGO or partner | Purchase order status updates |

Decide whether a donor must log in to pay, and tell the team. Letting guests donate keeps the demo shorter.

Push the middleware early, even before the pages are finished, so Members 1 and 2 can add it to their own routes.
You don't need to protect their endpoints for them.

## M3-2 One real PayPal capture · 9 Nov · max half a day

Our EUR checkout fails at buyer approval with `UNSUPPORTED_PAYEE_CURRENCY`, so we have never captured a payment.

1. Try a USD order with a fresh Sandbox business account.
2. If USD works, tell Member 1 so that `camp_demo`, the demo case and the supplier prices can move to USD.
3. If nothing works after half a day, stop, write down what you tried in the change log, and tell the team. We'll
   state the limitation honestly.

- Done when: one Sandbox donation shows as captured, confirmed by the server and saved in the database.

**If you fall behind:** finish M3-1 first. Keep the login simple; a working demo login is enough.
