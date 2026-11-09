# Authentication foundation

## Current step

The API uses Supabase Auth as the identity provider. `GET /api/auth/me` expects a Supabase access token in the `Authorization: Bearer <token>` header. The API validates it by calling the configured Supabase Auth `/auth/v1/user` endpoint with the server-side Supabase URL and anon key. It then finds the LIFELINE `User` profile whose `authUserId` matches the verified Supabase user ID.

The response is limited to the application profile's `id`, `email`, and `role`. Passwords and access/refresh tokens are never stored in the LIFELINE database or returned by this endpoint. The service-role key is not used by the browser or this identity lookup.

Add `SUPABASE_URL` and `SUPABASE_ANON_KEY` to the API environment to enable authenticated requests. Both are optional for starting the app; calling `/api/auth/me` or `/api/auth/profile` returns a configuration error until they are set. Keep them in server configuration, and never put service-role credentials in `NEXT_PUBLIC_*` variables.

## Application profiles and roles

Supabase Auth owns authentication credentials and verifies identities. The existing Prisma `User` is the application profile and continues to own LIFELINE relations such as campaigns, donations, approved allocations, and audit events. Its nullable, unique `authUserId` links a profile to a Supabase Auth user. Demo/system profiles can remain unlinked. `role` is nullable so a linked profile can remain pending until an operator assigns a supported role.

Authenticated application roles are:

| Role | Intended access |
| --- | --- |
| `NGO` | NGO dashboard, case review, results review, and allocation approval. |
| `DONOR` | Approved assistance/campaign viewing and funding an approved allocation. |
| `PARTNER` | Verified local supplier/distribution partner; pickup/delivery workflows are future work. |

Beneficiaries do not get a login role for this MVP. NGO-managed cases represent their assistance needs. Legacy `RECIPIENT` and `MERCHANT` values remain in the Prisma enum to avoid destructive changes to existing profiles, but they are not accepted as authenticated LIFELINE roles.

## Profile provisioning and role assignment

After Supabase signup/sign-in, the browser sends the access token to `POST /api/auth/profile`. This endpoint obtains the Auth user ID, email, and optional name from Supabase—not from request-body fields—and creates a LIFELINE profile with `role = null`. It is idempotent for a repeated request and relies on the unique `authUserId` constraint to converge concurrent requests. It never accepts a requested role from the browser. `/api/auth/me` returns the profile only after one of `NGO`, `DONOR`, or `PARTNER` is assigned; a null role returns the pending response. Legacy roles remain unsupported.

Role assignment is an operator-only CLI action, not an API exposed to a logged-in user. First create a user through `/login` and have them confirm email if Supabase requires it. The user's Supabase Auth UUID is available in the Supabase dashboard under Authentication → Users. In a trusted local environment with `DATABASE_URL`, `SUPABASE_URL`, and `SUPABASE_SERVICE_ROLE_KEY` set only in the server-side `.env`, run from the repository root:

```bash
npm run auth:assign-role --workspace @lifeline/api -- <supabase-auth-user-uuid> NGO
npm run auth:assign-role --workspace @lifeline/api -- <supabase-auth-user-uuid> DONOR
npm run auth:assign-role --workspace @lifeline/api -- <supabase-auth-user-uuid> PARTNER
```

Run the command once per test user with the intended role. The script validates the requested role, retrieves that user from the Supabase Admin API, and creates/updates only the profile matching that Auth UUID. Never put `SUPABASE_SERVICE_ROLE_KEY` in `NEXT_PUBLIC_*`, browser code, source control, or client-side configuration. For production, run controlled provisioning from a trusted operator environment and avoid distributing the service-role key.

## Boundary of this step

The foundation and UI provide Supabase email/password signup/sign-in, persisted browser sessions, server-side identity verification, pending profile provisioning, operator role assignment, and the safe `/api/auth/me` check. For immediate signup sessions in the local/demo MVP, disable **Confirm Email** in the Supabase project's Email provider settings. With confirmation enabled, Supabase returns no session at signup and this UI displays a setup error. This step does **not** add role guards on dashboard, allocation, donation, or other feature routes. Knowing a user's role does not itself restrict existing routes. Do not treat this as production authorization until route protection is added.

Automated tests mock the Supabase identity result and verify session resolution, unauthenticated rejection, pending/unsupported role rejection, safe response fields, self-provisioning without role assignment, and idempotent provisioning. They do not call a live Supabase project or execute the operator CLI against a real account.
