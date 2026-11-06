# Orchestration — Member 1

Chains Situation → Finance → Commerce for one case (`run-case.ts`, Day 3), served by `routes/cases.routes.ts`.
Returns a `CaseResult` (`packages/contracts/src/case.ts`) and stops honestly with `needs_information` or
`no_usable_route` instead of inventing a missing value. Payment steps stay separate and need NGO approval.
