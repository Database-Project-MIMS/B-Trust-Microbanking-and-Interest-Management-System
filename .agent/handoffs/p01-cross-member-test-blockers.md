# Phase 1 cross-member test blockers

**From:** Member 2 · **To:** Members 1, 4, 5 and integration lead · **Date/session:** 2026-09-18
**Status:** published

## What this gives you

While verifying the `main` into `dev` reconciliation on Windows, the Member 2 database
tests passed, but the full project gate exposed shared or cross-member failures:

- **Resolved during reconciliation:** `services/auth-service.ts` called
  `verifyPassword(password, user.password_hash)` even though the helper signature is
  `verifyPassword(hash, password)`.
- **Resolved during reconciliation:** `database/roles/01_app_grants.sql` lacked the
  `mims_app` `SELECT` grant on `agent` required by `validateSession()` and the `UPDATE`
  grant on `user_session` required by logout.
- **Resolved during reconciliation:** `tests/api/fd-products.test.mjs` deleted shared
  roles and left FD history rows behind. It now tracks role ownership, creates valid
  branch profiles, restores the product fixture, and removes all test-owned rows.
- `npm run db:create`: the npm script invokes `bash scripts/db-create.sh`; on a native
  Windows installation without WSL or Git Bash, `/bin/bash` is unavailable.

The earlier alias and `server-only` module-resolution failures are resolved by the merged
test command/package changes. During main/dev reconciliation, the developer explicitly
authorized Member 2 to correct the reversed password-helper arguments and add the missing
session permissions in M1-owned files. Ownership did not shift. Member 2 did not modify
the M5 implementation.

## Verification already completed

- `npm test`: 56/56 pass with database-backed test files serialized.
- Authentication tests: 5/5 pass; RBAC tests: 18/18 pass; FD API tests: 7/7 pass.
- Member 2 database tests: 13/13 pass (4 branch + 9 agent).
- All database test suites: 26/26 pass within the full run.
- After the FD API suite, the database retains exactly the original 3 FD plans and no
  test branch, user, or agent rows.
- `npm run db:verify`: all checks pass on PostgreSQL 18.6.
- `npm run typecheck`: passes.

## What's NOT stable yet

The project-wide test blockers found during reconciliation are resolved. The remaining
setup issue is `npm run db:create` requiring Bash on native Windows; `npm run db:rebuild`
already provides the working Node-based path used for verification.
