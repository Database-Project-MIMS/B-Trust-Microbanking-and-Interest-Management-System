# 06 — Seed Data Specification

**Owner:** Member 5 (integration) · each member supplies their own tables' rows (I-8).
**Rule:** synthetic Sri Lankan-style data only. Never real customer data (BR-20,
NFR-PRIV-02).

---

## Minimum targets

From the brief and SRS Appendix B.2. These are **minimums**; the seed exceeds several so
reports have enough variety to be interesting.

| Data set | Required | Seeded | Requirement |
|---|---|---|---|
| Branches | 3 | **3** | FR-ORG-01 |
| Agents | 5 | **6** | FR-ORG-01 |
| Customers | 15 | **18** | FR-CUS-05 |
| Joint accounts | 2 | **3** | brief |
| Savings accounts | — | **22** | — |
| Fixed deposits | 10 | **12** | FR-FD-05 |
| Transactions | 100 | **140** | brief, SRS B.2 |
| Application users | one per role | **9** (7 roles) | SRS B.2 |
| Interest runs | 2, incl. an idempotent re-run test | **3** | SRS B.2 |

## Determinism

Report totals must be reproducible, so nothing may be random at load time.

1. **Fixed UUIDs.** Every seeded row uses a hardcoded UUID with a readable prefix —
   `b0000000-0000-0000-0000-00000000000{1..3}` for branches, `c0000000-…` customers,
   `a0000000-…` accounts, `f0000000-…` FDs, `t0000000-…` transactions. Cross-references are
   then stable and human-readable in test failures.
2. **Fixed dates.** All dates are relative to a single anchor constant
   `SEED_ANCHOR_DATE = 2026-01-01`, so re-seeding next month does not change any total.
3. **No `random()`, no `now()`** in seed files. Timestamps are literals.
4. **Ordered load**, matching FK dependencies:

```
01_roles_users.sql        M1
02_branches_agents.sql    M2
03_plans_products.sql     M3 + M5
04_parameters.sql         M1
05_customers.sql          M2
06_accounts_holders.sql   M3
07_fixed_deposits.sql     M5
08_transactions.sql       M4
09_interest_runs.sql      M5
```

5. **Re-runnable.** Seeding twice produces identical counts and totals (`scripts/seed-check.mjs`).

## Branches

| Code | Name | District |
|---|---|---|
| `BR-COL` | Colombo Main | Colombo |
| `BR-KAN` | Kandy City | Kandy |
| `BR-GAL` | Galle Fort | Galle |

Six agents: 3 at Colombo, 2 at Kandy, 1 at Galle — deliberately uneven so RPT-01 shows a
real distribution rather than identical rows.

## Customers

18 customers with Sri Lankan names, NIC-format identifiers and Asia/Colombo addresses,
spread across branches. Ages are chosen to exercise **every** plan boundary:

| Age band | Count | Exercises |
|---|---|---|
| Under 13 | 3 | Children plan (12%, no minimum) |
| 13–17 | 3 | Teen plan (11%, LKR 500) |
| 18–59 | 9 | Adult plan (10%, LKR 1,000) and joint holders |
| 60+ | 3 | Senior plan (13%, LKR 1,000) |

Includes at least one customer whose age sits exactly on a boundary (12, 13, 17, 18, 59,
60) so eligibility tests have real edge cases.

## Accounts

22 accounts: 19 individual across the four age plans, plus **3 joint accounts** — two with
2 holders, one with 3 — all under the Joint plan (7%, LKR 5,000 minimum), each with a
stored mandate (two `ANY_ONE`, one `ALL_HOLDERS`) so both mandate paths are demonstrable.

Balances are spread from just above the plan minimum to LKR 500,000, including at least
one account sitting **exactly at** its minimum balance — the boundary case a withdrawal
test needs.

## Fixed deposits

12 FDs across all three products:

| Product | Count | Principal range |
|---|---|---|
| 6 months / 13% | 4 | LKR 50,000 – 200,000 |
| 1 year / 14% | 5 | LKR 100,000 – 500,000 |
| 3 years / 15% | 3 | LKR 250,000 – 1,000,000 |

Staggered `start_date` values so `next_interest_date` falls on different cycles. Includes
**one `MATURED` FD on an account that also has an `ACTIVE` FD** — the case that only works
if G-01 (partial unique index) is approved. If the team instead keeps the ERD's hard
`UNIQUE`, this row must be removed and the seed target drops to 11.

## Transactions

140 rows, deliberately mixed (the brief requires "a realistic mixture"):

| Type | Count | Share |
|---|---|---|
| `DEPOSIT` | 62 | 44% |
| `WITHDRAWAL` | 45 | 32% |
| `INTEREST_CREDIT` | 30 | 21% |
| `REVERSAL` | 3 | 2% |

Spread across all 3 branches, all 6 agents, all 5 plans and a 6-month date range so every
report filter returns non-trivial rows. The 3 reversals each link to an original
transaction so RPT-02 and RPT-05 must handle compensating entries correctly.

`INTEREST_CREDIT` rows are **not** hand-written — they are produced by running
`sp_run_interest_cycle` during seeding, which proves the interest path works and keeps
`interest_payout` consistent with the ledger.

## Interest runs

Three cycles at `SEED_ANCHOR_DATE + 30/60/90` days. The seed then **re-runs cycle 2** and
asserts that no additional `interest_payout` or `INTEREST_CREDIT` row appears — the
idempotency evidence required by SRS B.2 and AC-08, built into the seed rather than left
to a manual test.

## Expected report totals

`scripts/seed-check.mjs` asserts these after seeding. They are the regression baseline —
if a change to a routine alters a total, the check fails.

| Check | Expectation |
|---|---|
| Sum of all `current_balance` | equals the signed ledger sum (D-1 reconciliation) |
| `transaction` row count | ≥ 140 |
| `INTEREST_CREDIT` count | equals `interest_payout` count |
| Every `interest_payout` | has exactly one linked `INTEREST_CREDIT` |
| RPT-01 grand total | equals the sum of all transaction amounts by type |
| RPT-05 net movement | equals `deposits − withdrawals + interest` per customer |
| Accounts below plan minimum | **0** |
| Negative balances | **0** |
| FDs with 2 active rows on one account | **0** |
| Duplicate `(fd_id, cycle_date)` | **0** |

Exact numeric values are filled in by M5 once the seed is written (P01-M05-T03), then
frozen.

## Users

Nine application users covering all seven roles, with documented development-only
passwords in `docs/13_system-operation-guide.md`. Passwords are argon2id hashes in the
seed file — never plaintext, even in synthetic data.
