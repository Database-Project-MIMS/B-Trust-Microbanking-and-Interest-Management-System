# ADR-0013: Isolated verification and restricted health details

**Date:** 2026-10-05 · **Status:** Accepted for this user-authorized closeout

## Decision

Test commands provision a disposable local PostgreSQL cluster, rebuild and verify it,
then remove it. Full Phase 1 verification also runs typecheck, lint and a production build.
Rebuild accepts an empty configured database; existing development data can be reset
only with explicit `--reset`, restricted to `mims_dev` and `mims_test_*` names.
Migration DDL and its ledger record commit together. Verification checks all filenames
and content checksums, permitting only equivalent LF/CRLF line endings.

Health requires a validated session. Any authenticated role receives basic status;
ADMIN/CENTRAL_OPS receive infrastructure details and may open the health page. Services
own health SQL; routes/pages perform authorization before invoking them.

Session creation accepts the caller's transaction executor. Database expiry follows
configured inactivity and absolute limits; the browser cookie uses the absolute limit
so active sessions can refresh inactivity. Explicit audit writes also require an executor.

## Why

The prior migration test reset the configured development database and edited an actual
migration. Verification could pass despite pending migrations. Health trusted a cookie
name without validating it, and its page swallowed failed authorization. These behaviors
could not support the Phase 1 exit checkpoint. The user explicitly authorized resolving
them and recording approval, while retaining control of Git publication.

## Effect

M1/M4 ownership remains unchanged; no financial schema shape or merged migration changes.
`P02-M02-T01` becomes READY after the evidenced Phase 1 checkpoint. Cross-member repairs
remain local until the user chooses to publish them.
