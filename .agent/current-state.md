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

## M3 update (2026-10-07)

P02-M03-T03 built locally (REVIEW): `0242_p02_m03_joint_mandate.sql`, 32 new DB tests,
isolated suite 397/397; `/review` findings resolved. The user's PR is pending; next is M3-T04.
[Handoff](handoffs/p02-m03-t03-joint-mandate.md).

P02-M03-T04 is DONE (`0243`): `0243_p02_m03_sp_open_savings_account.sql`, 29 new DB tests;
`/review` findings resolved.

P02-M03-T05 built locally (REVIEW): accounts and holders APIs, `0244` idempotency table, `0245`
`sp_add_account_holder`, 38 new tests, isolated suite 464/464, typecheck/lint/build clean. The user's PR is
pending; next is M3-T06 (UI). [Handoff](handoffs/p02-m03-t05-accounts-api.md).
[Handoff](handoffs/p02-m03-t04-sp-open-savings-account.md).

## Task snapshot

P0 6 DONE; P1 19 DONE; P2 11 DONE / 2 REVIEW / 3 TODO; P3–P6 remain future work.
M1-T01/T02 DONE, M1-T03 TODO; M3-T01/T02 DONE, M3-T04 DONE, M3-T03 and M3-T05 REVIEW (local); M4-T01 DONE.
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
