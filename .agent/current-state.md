# Current State

**Updated:** 2026-10-07 · **Owner:** M2
**Checkout:** feat/p02-m02-customer-api-ui · base dev 25fc264; uncommitted T05 work

## Completed customer integration

M2 T01–T05 are technically DONE locally. T05 adds customer GET/POST and profile GET
routes, live registration/search/profile pages, migration 0223 child SELECT/INSERT
grants/RLS, shared setRlsContext and one sanitized customer-trigger audit.
M3's merged account_holder is read directly. No merged migration or another member's
service/security file was edited.

365 tests in 35 suites pass, zero failures/skips; clean isolated 19-migration rebuild,
typecheck, lint and production build. Browser flow covers synthetic registration,
profile navigation, masked identity, assignment/document metadata, filtered search,
duplicate errors and narrow-layout checks. Development data is preserved.
[Implementation, ownership, review and verification](handoffs/p02-m02-t05-customer-api-ui.md).

## Task snapshot

P0 6 DONE; P1 19 DONE; P2 10 DONE / 1 READY / 5 TODO; P3–P6 remain future work.
M1-T01/T02 DONE, M1-T03 TODO; M3-T01/T02 DONE, M3-T03 READY; M4-T01 DONE.
No new other-member completion is inferred by this task.

## Remaining coordination

M1 reviews 0223/security integration and completes its broader customer/account route
work. ADMIN mutation permission discrepancy remains restricted to AGENT/BRANCH_MANAGER.
Existing internal document verification is not exposed: narrow its role lock and
complete scoped UPDATE integration before adding a verification endpoint.
Account-opening services/pages and full Phase 2 seeds remain incomplete.

## Approval and publication

Phase 2 entry approval from 2026-10-05 remains valid; no later phase approval.
The user commits, pushes, opens PRs and merges. Nothing was committed or published
by the assistant. /review, /imprint and /remember records accompany this task.
