# P02-M03-T03: joint mandate and holder validation

**From:** Member 3 · **To:** Member 3 (T04), Member 1 (audit/RLS follow-up), Member 4 (Phase 3 withdrawal) · **Date:** 2026-10-07
**Status:** built and tested locally; `/review` and PR pending (the user publishes).

## What exists (migration `0242_p02_m03_joint_mandate.sql`)
- `joint_mandate` (one row per account): `mandate_type` ANY_ONE | ALL_HOLDERS, `required_signatories` 1–4, `effective_from/to`.
- `trg_validate_joint_mandate` (`AFTER INSERT`) and `trg_validate_joint_mandate_update` (`AFTER UPDATE`) — statement-level on `account_holder`, both call `fn_check_account_holder_sets`: lock the account row (`FOR NO KEY UPDATE`), then holder count within the plan's min/max, exactly one PRIMARY, no holder under 18 when `requires_all_adult`. Errors are `P0001`, message prefix plus named constraint: `INVALID_HOLDER_COUNT`/`ck_account_holder_count`, `MISSING_PRIMARY_HOLDER`/`ck_account_holder_one_primary`, `UNDERAGE_HOLDER`/`ck_account_holder_adult`.
- The same checker keeps an `ALL_HOLDERS` mandate's `required_signatories` equal to the holder count when holders change (so the holders API in T05 needs no mandate bookkeeping).
- `trg_joint_mandate_fit` — row-level on `joint_mandate`: `MANDATE_NOT_ALLOWED`/`ck_joint_mandate_multi_holder_plan` (single-holder plan), `INVALID_MANDATE_SIGNATORIES`/`ck_joint_mandate_signatories_fit`. Map them in the service by `err.constraint`.

## Contract for T04 (`sp_open_savings_account`)
1. Insert the account, then **all holders in ONE multi-row `INSERT`** (the check runs once per statement; one-by-one inserts fail on multi-holder plans).
2. For a joint account insert the mandate **after** the holders. The database cannot force "a joint account has a mandate" (holders come first) — T04 must.
3. Individual accounts get no mandate row.

## For Member 4 (Phase 3 withdrawal)
Read `joint_mandate` for the account inside the withdrawal transaction (BR-17). `ANY_ONE` needs 1 signatory; `ALL_HOLDERS` needs one per holder.

## For Member 1 (follow-up, not done in T03)
`fn_audit_master_changes` (0200) has no `mandate_id` case, so audit rows for `joint_mandate` would carry a NULL entity id; no RLS policy exists for the table yet. Needs a new M1 migration; 0200/0261 were not edited.

## Notes
- The trigger functions are `SECURITY DEFINER` with a fixed `search_path` so RLS cannot hide holders/customers from the integrity check; `EXECUTE` is revoked from `PUBLIC`. Tested as `mims_app` under a branch-scoped context.
- `tests/db/account-holder-constraints.test.mjs` test 4 was rewritten (Joint plan, one multi-row INSERT) because the new rule limits Adult accounts to one holder.
- Holder UPDATE is covered by the update trigger. Holder DELETE is not; `mims_app` has no DELETE grant on `account_holder`, so a future "remove holder" feature needs its own migration and trigger.
