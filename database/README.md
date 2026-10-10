# database/

The database is the deliverable. Everything here must rebuild from an empty PostgreSQL
database with `npm run db:rebuild` and no manual table editing (SRS §6.8).

## Execution order

`scripts/db-rebuild.mjs` applies, in this order:

1. `migrations/` — numbered ascending. Tables, columns, constraints.
2. `routines/`   — functions and procedures.
3. `triggers/`   — trigger functions and their bindings.
4. `views/`      — reporting and helper views.
5. `indexes/`    — indexes, each with a written justification.
6. `roles/`      — database roles, grants, RLS policies.
7. `seed/`       — deterministic synthetic sample data.

Steps 2–6 are **idempotent** (`CREATE OR REPLACE`, or `DROP … IF EXISTS` then create), so
they are re-applied wholesale on every rebuild. Only `migrations/` is append-only.

## Rules

- **A merged migration is immutable.** Corrections go in a new file with a new number.
- Use only numbers inside your reserved block (AGENTS.md §12).
- Naming: `NNNN_pPP_mMM_<slug>.sql`, e.g. `0342_p03_m04_post_withdrawal.sql`.
- Every file begins with a header comment: purpose, owner, requirement IDs satisfied,
  and the lecture concepts it demonstrates.
- Money uses the `money_amount` / `positive_money` domains; rates use `interest_rate`.
- Every index in `indexes/` states which query it serves and why a sequential scan was
  insufficient, with `EXPLAIN` evidence.

## Current contents

Eleven numbered migrations cover shared foundation, identity, parameters/audit,
organization, savings/FD products, channels, account and immutable transaction schemas.
Customer/holder/mandate and later financial objects remain future work. No merged
migration was changed during the 2026-10-05 closeout.

`npm run db:rebuild` requires an empty configured database. Resetting nonempty
`mims_dev` or `mims_test_*` requires explicit `--reset`; other names cannot be reset.
`npm run db:verify` compares every migration filename and checksum with the ledger.
`npm run verify:phase1` rebuilds/tests in a disposable local PostgreSQL cluster, then
removes it; the existing development database is preserved by test commands.

## Current predeployment load order

The canonical migration command's final runtime binder restores 0621–0639 controls
following legacy routine/view/role installation, including document verification, paired
transfers, account-sourced interest, principal receipts, extended reports, funding/reversal,
admin/reset and closure guards. Do not manually run old standalone core definitions after
that binder: use `db:migrate` / `db:rebuild`. `sp_post_deposit.sql` is updated to the current
0628 contract; merged migration definitions remain immutable. Generated docs/18 gives the
exact 70-migration / 28-table inventory verified on 2026-10-10.
