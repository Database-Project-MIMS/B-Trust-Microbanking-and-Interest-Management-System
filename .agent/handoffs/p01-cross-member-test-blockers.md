# Phase 1 cross-member test blockers

**From:** Member 2 · **To:** Members 1, 4, 5 and integration lead · **Date/session:** 2026-09-17
**Status:** published

## What this gives you

While verifying P01-M02-T01 on Windows, the Member 2 database tests passed, but the full
project gate exposed shared or cross-member failures:

- `npm test`: M1 authentication tests fail because Node cannot resolve the `@/lib` import
  used by `services/auth-service.ts`.
- `npm test`: M5 FD-product tests fail because Node cannot resolve the `server-only`
  package imported by `services/fd-product-service.ts`.
- `npm run db:create`: the npm script invokes `bash scripts/db-create.sh`; on a native
  Windows installation without WSL or Git Bash, `/bin/bash` is unavailable.

Member 2 did not modify M1, M4, M5, shared setup, or package files.

## Verification already completed

- `node --test tests/db/branch-constraints.test.mjs`: 4/4 pass.
- `npm run test:db`: 17/17 pass.
- `npm run db:verify`: all checks pass on PostgreSQL 18.6.
- `npm run typecheck`: passes.

## What's NOT stable yet

The task must remain `IN_PROGRESS` until the project-wide failing-test rule and clean
Windows rebuild requirement are resolved or explicitly accepted by the integration lead.
