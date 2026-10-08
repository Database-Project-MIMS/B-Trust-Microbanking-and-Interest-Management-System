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

P02-M03-T03 DONE, merged into dev: `0242_p02_m03_joint_mandate.sql`, 32 new DB tests,
isolated suite 397/397; `/review` findings resolved.
[Handoff](handoffs/p02-m03-t03-joint-mandate.md).

P02-M03-T04 is DONE (`0243`): `0243_p02_m03_sp_open_savings_account.sql`, 29 new DB tests;
`/review` findings resolved.

P02-M03-T05 DONE, merged into dev: accounts and holders APIs, `0244` idempotency table, `0245`
`sp_add_account_holder`, 38 new tests, isolated suite 464/464, typecheck/lint/build clean. The user's PR is
pending; next is M3-T06 (UI). [Handoff](handoffs/p02-m03-t05-accounts-api.md).
[Handoff](handoffs/p02-m03-t04-sp-open-savings-account.md).

P02-M03-T06 DONE, merged into dev: live account list, opening wizard, account detail with add-holder,
and the real plans page; 12 new model tests, isolated suite 486/486; `/review` important findings fixed, typecheck/lint/build clean.
Partial browser pass 2026-10-08 (list, plans, wizard to review step, server rejection of an unverified holder): no defects.
The successful opening and `/accounts/{id}` pages are untested: no verified document can exist yet (see Open coordination below).
[Handoff](handoffs/p02-m03-t06-account-screens.md).

## M3 update (2026-10-08)

P03-M03-T01 DONE: `database/routines/fn_check_plan_minimum.sql` (I-4, `fn_check_plan_minimum(account_id, resulting_balance)`),
`tests/db/fn-check-plan-minimum.test.mjs` 11/11 (single rolled-back transaction), isolated suite 497/497; `/review` findings resolved. No migration (routine file, like
`fn_check_plan_eligibility`). M4's `sp_post_withdrawal` is unblocked on the minimum check; the mandate check is P03-M03-T02.
[Handoff](handoffs/i-4-fn-check-plan-minimum.md). Branch: feat/p03-m03-fn-check-plan-minimum.

## Task snapshot

P0 6 DONE; P1 19 DONE; P2 14 DONE / 0 REVIEW / 2 TODO; P3 1 DONE (M3-T01); P4–P6 remain future work.
M1-T01/T02 DONE, M1-T03 TODO; M3-T01/T02 DONE, M3-T03, M3-T04 and M3-T05 DONE (merged into dev), M3-T06 DONE (merged into dev; happy-path browser pass blocked, see below); M4-T01 DONE.
No new other-member completion is inferred by this task.

## Remaining coordination

M1 reviews 0223/security integration and completes its broader customer/account route
work. ADMIN mutation permission discrepancy remains restricted to AGENT/BRANCH_MANAGER.
Existing internal document verification is not exposed: narrow its role lock and
complete scoped UPDATE integration before adding a verification endpoint.
Account-opening services/pages and full Phase 2 seeds remain incomplete.

## Open coordination raised by M3 (2026-10-08)

1. **Document verification is not exposed (M2).** `customer_document.verified_*` can only be set outside the
   app, so `sp_open_savings_account` / `sp_add_account_holder` (`DOCUMENTS_NOT_VERIFIED`) can never succeed for
   app-registered customers. See `open-questions.md` "Account opening blocked: no document verification path".
2. **Seeded branch managers cannot sign in (M1/M5).** `bm_*` users have no `agent` row but `validateSession` requires
   an ACTIVE agent row for BRANCH_MANAGER. See `open-questions.md` "Seeded branch managers cannot hold a session".

## Approval and publication

Phase 2 entry approval from 2026-10-05 remains valid; no later phase approval.
The user commits, pushes, opens PRs and merges. Nothing was committed or published
by the assistant. /review, /imprint and /remember records accompany this task.
