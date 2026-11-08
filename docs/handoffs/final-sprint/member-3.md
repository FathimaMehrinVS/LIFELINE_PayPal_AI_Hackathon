# Member 3 (Asiya Muhammed Sali): authentication, authorization and PayPal

Back to the [team board](README.md). Update status there, and details here.

Commerce and the donor plans page have moved to Member 1. Authentication and authorization implementation is complete;
the remaining tracked item is a successful PayPal Sandbox capture.

**Your files:** new `apps/api/src/middleware/auth.ts`, login pages in `apps/web/app/`, `integrations/paypal/`,
`routes/donation.routes.ts`, `apps/web/app/donate/`.

## M3-1 Login, profiles and roles · complete

**Implemented on `main`:** Supabase email/password signup, login and logout; server-side profile provisioning linked by
`User.authUserId`; unassigned users remain pending; roles are assigned through the controlled operator path. Signup
cannot assign a role. Details are in `docs/authentication.md`.

**Authorization checkpoint (`4e93e02`):** API requests verify Supabase access tokens, resolve the application role from
the server-side `User` profile, and enforce authentication, role and ownership checks. NGO-only actions are protected;
supported DONOR and PARTNER access is role-checked. The web app sends its current access token to the API, and existing
application routes use the authenticated shell while `/login` remains standalone. Families/beneficiaries do not log in.

Do not put demo passwords or credentials in tracked documentation. Provision demo identities through the documented
operator process in `docs/authentication.md` and supply credentials securely for the demo.

| Access | Endpoints |
|---|---|
| Open | `/health`, sending a report, `GET /api/plans`, the PayPal webhook (it checks its own signature) |
| NGO only | Approve, suppliers, supplier payments, cases list |
| NGO or partner | Purchase order status updates |

The table records the current intended access boundaries; the implementation is enforced server-side by the committed
authorization middleware and route checks, not by hiding navigation links.

## M3-2 One real PayPal Sandbox capture · still open

OAuth and Sandbox order creation have succeeded, but buyer approval has failed with `UNSUPPORTED_PAYEE_CURRENCY`;
there is no verified successful capture. The seller/app chain and EUR balance were checked, but holding EUR did not
resolve the Checkout receiving error. Do not create another order or change currencies until the team explicitly
authorizes a new test and the receiving restriction is resolved.

- Done when: one Sandbox donation shows as captured, confirmed by the server and saved in the database.
- Verify the persisted capture ID, exact amount/currency, and Donation → approved allocation → case relationship.
- Do not mark an order captured from a browser redirect or fabricate webhook events. Live webhook verification remains
  a separate deployment task requiring a public HTTPS endpoint and registered PayPal webhook.

**Current status:** M3-1 is complete. M3-2 remains blocked on PayPal Sandbox buyer approval; report the exact PayPal
error and keep Donation/payment state truthful until a capture succeeds.
