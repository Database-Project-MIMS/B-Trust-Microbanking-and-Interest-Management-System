# ADR-0004: current_balance as a maintained denormalisation

**Date:** Phase 0 · **Status:** Accepted

## Decision

`account.current_balance` is stored redundantly — it is derivable as
`SUM(signed transaction amounts)` for that account — but is maintained directly by the
posting routines (`sp_post_deposit`, `sp_post_withdrawal`, `sp_reverse_transaction`) inside
the same transaction as the ledger insert, and checked continuously against the ledger by
`vw_ledger_reconciliation` (Phase 5).

## Why

Computing the balance by summing the entire transaction history on every balance read
(every account page view, every withdrawal validation) does not scale, and the assignment
explicitly rewards demonstrated indexing/performance awareness (L10, NFR-PERF).
Recomputing from scratch is also the naive-but-safe default a database course would
expect to see explicitly justified rather than silently done.

## What it rules out

- Treating `current_balance` as authoritative on its own — the ledger is authoritative;
  `current_balance` is a cache of it
- Any code path that updates `current_balance` outside a posting routine, or outside the
  same transaction as the ledger row

## Consequence

This is documented as denormalisation D-1 in `docs/04_database-schema.md`'s
denormalisation register, and its correctness is continuously verified rather than merely
assumed — see `vw_ledger_reconciliation` and the Phase 5 exit criteria in
`docs/phases/phase-05-reports-audit-reconciliation.md`.
