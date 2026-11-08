# Member 3 (Asiya Muhammed Sali): login and PayPal

Back to the [team board](README.md). Update status there, and details here.

You have the shortest list on purpose, because login is a big job. Commerce and the donor plans page have moved to
Member 1.

**Your files:** new `apps/api/src/middleware/auth.ts`, login pages in `apps/web/app/`, `integrations/paypal/`,
`routes/donation.routes.ts`, `apps/web/app/donate/`.

## M3-1 Login and roles · 9 Nov · in progress

Members 1 and 2 are waiting on this shape, so please confirm it or tell them what changed:

- **Login uses Supabase Auth.** The browser signs in and sends the Supabase access token to our API.
- **Backend:** a `requireRole("NGO")` middleware that verifies the token on the server and sets `req.user` to
  `{ id, role }`. Use the existing `Role` values: `NGO`, `DONOR`, `MERCHANT`.
- **Keep the role in Supabase `app_metadata`,** not `user_metadata`, because users can edit their own `user_metadata`.
  Never trust a role sent by the browser.
- **Keys:** the Supabase service role key stays on the server only. Add any new variables to `.env.example` and tell
  Member 1, so they can be set on Render.
- **Frontend:** a way for any page to get the current user, and a sidebar that shows only that role's pages.
- **Demo accounts:** one NGO, one donor and one supplier in the seed, written in the README for the judges.
- **Tests:** a simple way to pass a fake user, so all tests keep passing without a real login.
- **Families never log in.**

| Access | Endpoints |
|---|---|
| Open | `/health`, sending a report, `GET /api/plans`, the PayPal webhook (it checks its own signature) |
| NGO only | Approve, suppliers, supplier payments, cases list |
| NGO or supplier | Purchase order status updates |

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
