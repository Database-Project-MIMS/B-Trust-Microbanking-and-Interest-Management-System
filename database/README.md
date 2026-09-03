# database/

The database is the deliverable. Everything here must rebuild from an empty PostgreSQL
database with `npm run db:rebuild` and no manual table editing (SRS §6.8).

## Execution order

`scripts/db-rebuild.sh` applies, in this order:

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

Only `migrations/0000_p00_shared_foundation.sql`. Business tables begin in Phase 1.
