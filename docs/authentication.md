# Authentication foundation

## Current step

The API uses Supabase Auth as the identity provider. `GET /api/auth/me` expects a Supabase access token in the `Authorization: Bearer <token>` header. The API validates it by calling the configured Supabase Auth `/auth/v1/user` endpoint with the server-side Supabase URL and anon key. It then finds the LIFELINE `User` profile whose `authUserId` matches the verified Supabase user ID.

The response is limited to the application profile's `id`, `email`, and `role`. Passwords and access/refresh tokens are never stored in the LIFELINE database or returned by this endpoint. The service-role key is not used by the browser or this identity lookup.

Add `SUPABASE_URL` and `SUPABASE_ANON_KEY` to the API environment to enable authenticated requests. Both are optional for starting the app; calling `/api/auth/me` with a token returns a configuration error until both are set. Keep them in server configuration, and never put service-role credentials in `NEXT_PUBLIC_*` variables.

## Application profiles and roles

Supabase Auth owns authentication credentials and verifies identities. The existing Prisma `User` is the application profile and continues to own LIFELINE relations such as campaigns, donations, approved allocations, and audit events. Its nullable, unique `authUserId` links a profile to a Supabase Auth user. Demo/system profiles can remain unlinked.

Authenticated application roles are:

| Role | Intended access |
| --- | --- |
| `NGO` | NGO dashboard, case review, results review, and allocation approval. |
| `DONOR` | Approved assistance/campaign viewing and funding an approved allocation. |
| `PARTNER` | Verified local supplier/distribution partner; pickup/delivery workflows are future work. |

Beneficiaries do not get a login role for this MVP. NGO-managed cases represent their assistance needs. Legacy `RECIPIENT` and `MERCHANT` values remain in the Prisma enum to avoid destructive changes to existing profiles, but they are not accepted as authenticated LIFELINE roles.

## Boundary of this step

This change establishes server-side identity verification, profile-to-identity linkage, role validation, and the safe `/api/auth/me` check. It does **not** add sign-up/sign-in UI, profile provisioning, email verification, session refresh handling, or role guards on dashboard, allocation, donation, or other feature routes. Until those authorization guards are implemented in the next step, knowing a user's role does not itself restrict existing routes. Do not treat this foundation as production authorization.

Automated tests mock the Supabase identity result and verify session resolution, unauthenticated rejection, unsupported/missing role rejection, and safe response fields. They do not call a live Supabase project.
