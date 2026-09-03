# 12 — Testing and Acceptance

Every acceptance criterion maps to at least one test. A criterion without a test is not
satisfied.

**Layers:** `tests/db` SQL-level constraints, routines, triggers, concurrency ·
`tests/api` route handlers, authorization, injection · `tests/e2e` critical workflows ·
`database/tests` pure SQL assertions runnable with `psql`.

---

## Acceptance criteria matrix

| AC | Criterion | Test | Layer | Owner |
|---|---|---|---|---|
| AC-01 | Runs locally from documented steps; deploys via CI/CD | `db:rebuild` + `db:verify` in CI; staging smoke test | ops | M1/M5 |
| AC-02 | **No ORM, Supabase or Firebase**; SQL visible in the repo | `dependency-guard.test.mjs` — fails if a banned package appears in `package.json` or a lockfile | api | M1 |
| AC-03 | Schema shows normalisation, PK/FK, constraints, routines, triggers, indexes | `schema-inventory.test.mjs` — asserts every table has a PK, counts routines/triggers/indexes | db | M4 |
| AC-04 | Register a customer, open an individual account, open a joint account | `e2e/onboarding.test.mjs` | e2e | M2/M3 |
| AC-05 | Post a deposit and an eligible withdrawal; invalid ones rejected | `db/withdrawal-rules.test.mjs`, `api/transactions.test.mjs` | db+api | M4 |
| AC-06 | Concurrent/repeated requests create no duplicate or overspent transaction | `db/concurrency.test.mjs`, `api/idempotency.test.mjs` | db+api | M3/M4 |
| AC-07 | Open an FD, run a 30-day cycle, see a separate credit | `e2e/fd-interest.test.mjs` | e2e | M5 |
| AC-08 | No second active FD; no duplicate FD-cycle interest | `db/fd-constraints.test.mjs`, `db/interest-idempotency.test.mjs` | db | M5 |
| AC-09 | All five reports produce correct totals with matching CSV | `api/reports.test.mjs` — compares JSON totals to CSV totals | api | each report owner |
| AC-10 | Posted transactions immutable; reversal preserves the original | `db/ledger-immutability.test.mjs`, `db/reversal.test.mjs` | db | M4 |
| AC-11 | Unauthorized users cannot reach data outside their role/branch | `api/authorization.test.mjs`, `db/rls.test.mjs` | api+db | M1 |
| AC-12 | Sample database has all required counts | `db/seed-validation.test.mjs` | db | M2/M5 |
| AC-13 | Backup, restore, migration and rollback evidence | `P06-M05-T02` documented run | ops | M5 |
| AC-14 | Automated tests pass before demonstration | CI gate on `develop` and `main` | ops | M1 |

---

## Database constraint tests

| Test | Asserts | Rule |
|---|---|---|
| Negative balance rejected | `UPDATE account SET current_balance = -1` raises `23514` | NFR-SAFE-01, G-18 |
| Zero/negative amount rejected | `INSERT transaction (amount = 0)` violates `positive_money` | DB-CON-03 |
| Duplicate account number | second insert raises `23505` | FR-ACC-01 |
| Duplicate transaction reference | second insert raises `23505` | BR-10, G-05 |
| Duplicate NIC | second customer raises `23505` | FR-CUS-04 |
| Two active FDs on one account | second insert raises `23505` on the partial unique index | BR-12, G-01 |
| Duplicate `(fd_id, cycle_date)` | raises `23505` | FR-INT-03 |
| Two active agent assignments | raises `23505` on the partial index | FR-CUS-02, G-10 |
| Delete a referenced branch | raises `23503` | FR-ORG-05, BR-S7 |
| Joint account with 1 holder | mandate trigger raises | BR-07 |
| Joint account with 5 holders | mandate trigger raises | §4.4 |
| No floating-point money column exists | information_schema query returns 0 | SRS §6.1 |

## Procedure and function tests

| Test | Asserts |
|---|---|
| `fn_calculate_fd_interest` | `100000 × 0.1400 × 30 / 365 = 1150.68` exactly, as `numeric` |
| Interest rounding | result always has exactly 2 decimal places |
| `fn_check_plan_eligibility` | 12-year-old accepted for Children, rejected for Teen; 60-year-old accepted for Senior; boundary ages 12/13/17/18/59/60 all behave |
| `sp_post_deposit` | balance increases by exactly the amount; `balance_after` matches; one ledger row; one audit row |
| `sp_post_withdrawal` below minimum | raises; **no ledger row, no balance change, no partial state** |
| `sp_reverse_transaction` | original row unchanged; compensating entry created and linked; balance restored |
| Reverse twice | second attempt raises `23505` (DB-CON-04) |
| `sp_open_fixed_deposit` insufficient balance | raises; no FD row and no debit |
| `sp_run_interest_cycle` | run row records `fd_count` and `total_interest` matching the sum of payouts |
| One failing FD in a run | other distributions still commit; `exception_count` = 1 (FR-INT-04) |

## Concurrency tests

Real parallel connections, not sequential calls.

| Test | Setup | Expected |
|---|---|---|
| **Concurrent withdrawals** | Balance 1,000. Two clients each withdraw 600 simultaneously | Exactly one succeeds; the other is rejected; final balance 400; **never** −200 (AC-06) |
| Concurrent deposits | Two clients deposit 500 each | Both succeed; balance increases by exactly 1,000 (no lost update) |
| Concurrent FD opening | Two clients open an FD on the same account | Exactly one succeeds; the other gets `23505` |
| Concurrent interest runs | Same `cycle_date` started twice | One run; no duplicate payout (NFR-SAFE-03) |
| Deadlock avoidance | Two multi-account operations in opposite order | Ordered locking prevents deadlock, or one retries and succeeds |

## Rollback tests

| Test | Asserts |
|---|---|
| Failure mid-deposit | injected error after the ledger insert leaves **no** ledger row and **no** balance change |
| Failure mid-account-opening | no account, no holder, no mandate, no initial deposit |
| Failure mid-FD-opening | no FD row and the principal is not debited |
| Constraint violation inside a procedure | whole transaction rolls back; `pg_stat` shows no orphan |

## Idempotency and duplicate tests

| Test | Asserts |
|---|---|
| Same `Idempotency-Key` twice | second call returns the **original** transaction; balance credited once (FR-DEP-04) |
| Different keys, same amount | two distinct transactions — a legitimate repeat deposit still works |
| Missing `Idempotency-Key` on a money endpoint | `400` |
| Interest cycle re-run | `409 RUN_ALREADY_EXISTS`; zero new payouts and zero new ledger rows (AC-08) |

## Authorization tests

A full matrix: every role × every route.

| Test | Asserts |
|---|---|
| Agent reads another branch's customer | `403`, even with an edited URL or request body (AC-11) |
| Agent attempts a reversal | `403` — managers only |
| Customer reads another customer's account | `403`; RLS blocks it even if the service check is bypassed |
| Auditor attempts a deposit | `403` — read-only role |
| Expired session | `401`; the session row is expired in the database, not just the cookie |
| Revoked session | `401` immediately — proves server-side invalidation (FR-AUTH-04) |
| Report request for another branch | `403`, and the SQL never returned the rows |

## SQL injection tests

| Payload target | Input | Expected |
|---|---|---|
| Customer search | `'; DROP TABLE transaction; --` | Treated as a literal search string; `transaction` still exists |
| Account number lookup | `1' OR '1'='1` | No match; no rows leaked |
| Report sort column | `amount; DELETE FROM account` | Rejected by `allowListed()`; falls back to the default column |
| Report date filter | `2026-01-01' UNION SELECT password_hash FROM app_user --` | Parameter binding rejects it; no hash returned |
| Narration field | `<script>alert(1)</script>` | Stored as text; escaped on render (XSS) |

Every one of these must pass **because of parameter binding**, not because of input
sanitising.

## Report validation

| Test | Asserts |
|---|---|
| RPT-01…RPT-05 grand totals | equal the sum of the underlying ledger rows for the same filters |
| CSV export | byte-for-byte identical totals to the on-screen report (REP-COM-04) |
| Branch-scoped report | a branch manager's row count equals the count of their branch's rows only (REP-COM-02) |
| Report with reversals | net totals account for compensating entries |
| Empty filter range | returns zero rows and a zero total, not an error |
| Report metadata | title, filters, generation time and requesting user all present (REP-COM-01) |

## Performance

| Test | Target | Requirement |
|---|---|---|
| Page and lookup requests | < 2 s for 95% | NFR-PERF-01 |
| Deposit / withdrawal posting | < 3 s | NFR-PERF-02 |
| Each management report on the sample dataset | < 5 s | NFR-PERF-03 |
| Scale probe: 1,000,000 synthetic ledger rows | reports still complete; index plans hold | NFR-PERF-04 |
| `EXPLAIN ANALYZE` for every report | index scan, not a sequential scan on `transaction` | SRS §6.7 |

The scale probe is generated into a scratch schema, never into the demonstration database.

## Running

```bash
npm run db:rebuild     # clean schema + seed
npm test               # all suites
npm run test:db        # SQL-level only
npm run test:api       # route handlers only
```

CI gate on `develop` and `main`: lint · typecheck · migrations apply to a **clean**
database · all tests pass (SRS §9.2).

## Coverage expectations

Not a line-coverage number — a rule-coverage rule: **every rule in
`07_business-rules.md` has at least one negative test proving it is enforced.** A rule
with only a happy-path test is untested.
