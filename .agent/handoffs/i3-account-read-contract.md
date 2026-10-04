# I-3: `account` status / balance read contract

**From:** Member 3 · **To:** Member 4 (posting routines), Member 5 (FD opening) · **Date/session:** 2026-10-04
**Status:** draft — final once P02-M03-T04 lands (`account_holder`/`joint_mandate` do not change this contract)

## What this gives you

Migration `0240_p02_m03_account.sql` creates `account`:

| Column | Type | Notes |
|---|---|---|
| `account_id` | uuid PK | lock target |
| `status` | varchar(20) | `ACTIVE` / `FROZEN` / `CLOSED` (`ck_account_status`) |
| `current_balance` | `money_amount` (`numeric(15,2)`) | `NOT NULL DEFAULT 0`, `CHECK (>= 0)` (`ck_account_balance_non_negative`) |
| `branch_id` | uuid | fixed at opening; any UPDATE of it raises `23514` / `ck_account_branch_immutable` |
| `plan_id` | uuid FK → `savings_plan` | join for `min_balance` |

Expected locking behaviour (AGENTS.md §11): posting routines run
`SELECT account_id, status, current_balance FROM account WHERE account_id = $1 FOR UPDATE`,
then re-validate `status = 'ACTIVE'` and the balance **after** the lock, then insert the
ledger row and `UPDATE account SET current_balance = …` in the same transaction.
`current_balance` is written only by posting routines (D-1). The `CHECK` is the last line
of defence, not a substitute for the lock.

## Example usage

```sql
SELECT current_balance, status FROM account WHERE account_id = $1 FOR UPDATE;
-- decide, insert transaction row, then:
UPDATE account SET current_balance = current_balance - $2 WHERE account_id = $1;
```

## What's NOT stable yet

- `account_number` generation (`fn_next_account_number`) arrives with P02-M03-T04.
- The `fixed_deposit` FK to `account` and the closure rule (`sp_close_account`, BR-18) are Phase 4.
