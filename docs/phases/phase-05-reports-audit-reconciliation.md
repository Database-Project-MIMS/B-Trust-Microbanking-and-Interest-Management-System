# Phase 05 — Reports, Audit & Reconciliation

**Status:** TODO · **Tasks:** 15 · **Effort:** 51 points · **Est.** ~1 week

## Entry criteria

- [ ] Phase 4 exit criteria met
- [ ] Seed data complete, so report totals are meaningful

## Tasks by member

| Member | Focus |
|---|---|
| **M1** | Report framework: filters, scope, metadata (**I-7**); CSV export; report access auditing; audit search API and page |
| **M2** | **RPT-01** agent-wise totals — view, API, page, CSV |
| **M3** | **RPT-02** account-wise summary with opening/closing balance |
| **M4** | **RPT-05** customer activity; **reconciliation** view and page |
| **M5** | **RPT-03** active FDs; **RPT-04** monthly interest distribution; index and `EXPLAIN ANALYZE` review |

## The five reports

| Report | Required content | SQL technique |
|---|---|---|
| RPT-01 Agent-wise | Date range, branch, agent, count, total deposits, withdrawals, interest, net | `GROUP BY`, aggregation (L05) |
| RPT-02 Account-wise | Account, plan, holders, opening/closing balance, counts and totals by type | Window functions (L13) |
| RPT-03 Active FDs | FD, account, holders, principal, product, rate, start, maturity, next payout, status | Joins, date arithmetic (L05) |
| RPT-04 Monthly interest | Cycle, product/account type, distribution count, total interest, exceptions | **`ROLLUP` / `GROUPING SETS`** (L13) |
| RPT-05 Customer activity | Customer, accounts, total deposits, withdrawals, interest, net movement | Aggregation + outer joins (L05, L13) |

## Non-negotiables for every report

- Title, filter values, generation timestamp and requesting user displayed (REP-COM-01)
- **Branch scope applied in the SQL `WHERE` clause**, never by filtering fetched rows
  (REP-COM-02)
- Detail rows plus clearly labelled subtotals and grand totals (REP-COM-03)
- **CSV uses the same query and produces identical totals** (REP-COM-04)
- Paginated or streamed; never load everything into browser memory (REP-COM-05)
- Every report access is audited (REP-COM-06)

## Reconciliation

`vw_ledger_reconciliation` asserts, for every account:

```
account.current_balance
  = SUM(signed ledger amounts)
  = last transaction.balance_after
```

This is what makes the two documented denormalisations (D-1, D-2) defensible rather than
risky — the duplication exists, and it is continuously checked against its source.

## Exit criteria

- [ ] All five reports return correct rows with working filters
- [ ] Every report's grand total reconciles with the underlying ledger
- [ ] CSV totals match the screen exactly for the same filters
- [ ] A branch manager sees only their branch's rows
- [ ] Report access appears in the audit log
- [ ] Audit search works by actor, entity, action and date
- [ ] Reconciliation shows zero discrepancies across the seeded data
- [ ] `EXPLAIN ANALYZE` shows **index scans, not sequential scans**, on `transaction` for every report
- [ ] Each report completes within 5 seconds on the sample dataset (NFR-PERF-03)

## Risks

| Risk | Mitigation |
|---|---|
| Four members blocked on M1's framework | I-7 published early in the phase; report **views** can be built before the framework lands |
| Reports disagree with the ledger after reversals | Reversal handling explicitly tested in every report |
| Sequential scans on a large ledger | Reporting indexes were created in Phase 3; verified here with `EXPLAIN ANALYZE` |
