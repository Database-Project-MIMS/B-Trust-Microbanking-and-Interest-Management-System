# ADR-0011: One active fixed deposit per savings account

**Date:** 2026-10-02 · **Status:** Accepted · **Resolves:** OQ-01 (ERD gap G-01)

## Decision

Only a customer with a savings account can open a fixed deposit, and a savings account can
hold **at most one active FD at a time**. After an FD matures or closes, the same account
may open a new one.

The ERD's table-level `UNIQUE (account_id)` on `fixed_deposit` is replaced by a partial
unique index:

```sql
CREATE UNIQUE INDEX ux_fixed_deposit_one_active
    ON fixed_deposit (account_id)
    WHERE status = 'ACTIVE';
```

## Why

SRS FR-FD-02, BR-12 and NFR-SAFE-04 all say "one **active** FD". The ERD's plain `UNIQUE`
would allow one FD per account for its whole life and make `status` decorative. The partial
index keeps the one-at-a-time guarantee and lets the open → interest cycle → credit
demonstration repeat on the same account.

## What it rules out

- A plain `UNIQUE (account_id)` on `fixed_deposit`
- Relying on a prior `SELECT` to prevent a second active FD

## Consequences

- `sp_open_fixed_deposit` relies on the index for the race-condition guarantee and maps the
  unique violation to a `409` business-rule conflict.
- The FD must be funded by debiting principal from the linked savings account in the same
  transaction as the FD insert.
- A negative test must prove that two concurrent opens on one account produce one active FD.
- `docs/04` and `docs/07` (BR-12) need updating when the FD schema task is built.
