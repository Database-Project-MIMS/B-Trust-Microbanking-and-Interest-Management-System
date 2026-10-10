# ADR-0008: Savings accounts store their owning branch

**Date:** 2026-10-01 · **Status:** Accepted

## Decision

Every savings account stores `branch_id uuid NOT NULL` referencing `branch(branch_id)`
with `ON DELETE RESTRICT`. The owning branch is copied from the authorised account-opening
context when the account is created and does not change when the opening agent later moves
to another branch.

Queries and RLS policies use `account.branch_id` as the account's branch-scope anchor. An
index on `(branch_id, status)` supports scoped active-account access.

## Why

Deriving branch ownership through `opened_by_agent_id → agent.branch_id` would rewrite
history whenever an agent transfers. That would retroactively change report totals and
which branch-scoped users can see an existing account.

## What it rules out

- Deriving an account's current or historical branch from the agent's current branch
- Moving old accounts implicitly when an agent transfers
- Filtering account rows in application memory after a bank-wide database query

## Consequences

- `P02-M03-T01` adds the required FK and `(branch_id, status)` index.
- Account creation sets the branch from trusted server-side scope, not request-controlled
  identity data.
- RLS and branch reports use the stored account branch.
- This intentional historical snapshot is recorded as denormalisation D-4.
