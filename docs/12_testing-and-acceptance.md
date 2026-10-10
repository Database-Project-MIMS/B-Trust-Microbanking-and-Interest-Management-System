# 12 — Testing and Acceptance

## Current predeployment evidence — 2026-10-10 / ADR-0027

Final `npm run verify:phase1 -- --catalog --tap` passed **3,397 tests / 116 suites**:
2,240 security checks plus 1,157 API/DB/e2e tests; zero failures, cancellations or skips.
Typecheck, ESLint and Next 15.5.27 production build passed. Clean **70-migration / 28-table**
rebuild/checksums and exact pg_dump/pg_restore (all tables, money, constraints, RLS,
ownership and sequences) passed within the same full run. Existing development data
was preserved. Temporary test/preview clusters and browser tab were cleaned up.
Host: Node 24.15.0 / PostgreSQL 18.6; `.nvmrc` retains Node 22.

New API regressions cover real runtime deposit replay/concurrency, document verification,
paired staff transfer/reversal/shared debit limits, strict statement/user/audit filters,
Origin/Host normalization, profile creation/session revocation, single-use reset expiry/
races, safe closure-interest denial and reconciliation scope. SQL regressions add funded
open-day balances, delayed savings catch-up/nonoverlap, FD due-date catch-up, one-time
principal return, partial-pair rejection, maturity fault rollback and closure guard.

Security inventory includes every exported handler and all seven roles, injection positions,
valid free-text binding, nine direct-login RLS checks and six local deployment configuration
checks. Denials preserve business/audit row fingerprints including new reset/maturity controls.
Interactive browser evidence and its exact scope are recorded in [docs/21](21_predeployment-audit.md).
The accepted savings/transfer implementation and operational financial frontend are present;
live HTTPS, target-runtime acceptance and a fuller closing settlement policy remain separate.

The original criterion mapping below is a requirement map, not blanket acceptance evidence.
Historical verification receipts later in this document retain their original date/base.

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
| AC-06 | Concurrent/repeated requests create no duplicate or overspent transaction | `db/concurrent-withdrawals.test.mjs` (P06-M03-T01), `db/sp-post-withdrawal.test.mjs`, `api/idempotency.test.mjs` | db+api | M3/M4 |
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

**Phase 1 evidence (2026-10-05):** `npm run verify:phase1` passes 184 tests with
zero failures/skips, exact 11-migration verification, clean rebuild, typecheck, lint
and production build. Test commands provision/remove a disposable local PostgreSQL
cluster; migration mutation tests operate on copied fixtures. See the
[approved checkpoint](../.agent/checkpoints/phase-01-checkpoint.md).
The matrix above includes planned later-phase coverage; passing Phase 1 does not
claim financial operations, full RLS or full transactional seed targets are delivered.

| Test | Asserts | Rule |
|---|---|---|
| Negative balance rejected | `UPDATE account SET current_balance = -1` raises `23514` | NFR-SAFE-01, G-18 |
| Zero/negative amount rejected | `INSERT transaction (amount = 0)` violates `positive_money` | DB-CON-03 |
| Duplicate account number | second insert raises `23505` | FR-ACC-01 |
| Duplicate transaction reference | second insert raises `23505` | BR-10, G-05 |
| Canonical constraint suite — `savings_plan`, `account`, `account_holder`, `joint_mandate` (P06-M03-T02, `tests/db/constraint-suite-plans-accounts.test.mjs`) | Every CHECK, UNIQUE (incl. the partial one-PRIMARY index) and FK has an individual negative test with SQLSTATE and constraint name; delete of a referenced account/plan/customer raises `23503`; `trg_validate_joint_mandate` rejects 1-holder and 5-holder Joint accounts. Runs in rolled-back transactions. A completeness guard compares `pg_constraint`/unique indexes with the covered list, so a new constraint fails the suite until it is tested. | NFR-SAFE-01, G-06, G-08, G-18 |
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
| Concurrent withdrawals under contention (P06-M03-T01, `tests/db/concurrent-withdrawals.test.mjs`) | 2, 4 and 5 racers on one account, each on its own pooled connection: 2×600 on 1,000 (`INSUFFICIENT_FUNDS`); Teen 2×600 on 1,500 (`BELOW_MINIMUM_BALANCE`, balance 900); 5×300 (3 win, balance 100); 5×400 (2 win, balance 200); 4×333.33 (balance 0.01); deposits mixed with withdrawals; 10 repeated rounds | Winners never exceed what the balance allows; never both, never neither; `current_balance` = start + deposits − withdrawals from the ledger; `balance_after` chains exactly in `ledger_seq` order; one audited `WITHDRAWAL_REJECTED` per loser. A test holds `FOR UPDATE` on the row and asserts via `pg_stat_activity` that all racers are queued on the lock, so the race cannot pass vacuously. Removing `FOR UPDATE` from `sp_post_withdrawal` fails all eight tests. |
| Concurrent deposits | Two clients deposit 500 each | Both succeed; balance increases by exactly 1,000 (no lost update) |
| Concurrent FD opening | Two clients open an FD on the same account | Exactly one succeeds; the other gets `23505` |
| Concurrent interest runs | Same `cycle_date` started twice | One run; no duplicate payout (NFR-SAFE-03) |
| Deadlock avoidance | Two multi-account operations in opposite order | Ordered locking prevents deadlock, or one retries and succeeds |

## Rollback tests

**Adversarial partial-failure evidence (P06-M04-T01, `tests/db/rollback-idempotency-evidence.test.mjs`):**
Using temporary fault-injection triggers executed by the migration owner, faults are injected at intermediate statements inside core posting routines. All operations execute under `mims_app` with RLS context:

| Test | Asserts |
|---|---|
| Failure mid-deposit (`sp_post_deposit`) | A dynamic trigger raises on `account` `UPDATE` after ledger `INSERT`. Result: whole transaction rolls back, 0 ledger rows created, 0 audit rows created, `current_balance` unchanged (FR-DEP-05). |
| Failure mid-withdrawal (`sp_post_withdrawal`) | A dynamic trigger raises on `audit_log` `INSERT` after ledger `INSERT` and balance `UPDATE`. Result: whole transaction rolls back, 0 ledger rows, 0 audit rows, `current_balance` unchanged. |
| Failure mid-reversal (`sp_reverse_transaction`) | A dynamic trigger raises on `transaction_reversal` `INSERT` after the compensating ledger entry. Result: neither the link nor the orphaned compensating ledger entry survives; original transaction remains eligible for reversal. |
| Failure mid-account-opening | no account, no holder, no mandate, no initial deposit |
| Failure mid-FD-opening | no FD row and the principal is not debited |
| Constraint violation inside a procedure | whole transaction rolls back; `pg_stat` shows no orphan |

## Idempotency and duplicate tests

**HTTP & database idempotency replay (P06-M04-T01, `tests/db/rollback-idempotency-evidence.test.mjs`):**
A real round-trip against `POST /api/transactions/deposits` with agent session and CSRF tokens verifies end-to-end replay:

| Test | Asserts |
|---|---|
| Same `Idempotency-Key` twice | First request returns HTTP 201; second request with identical key & body replays exact original response with HTTP 200; exactly 1 ledger row inserted, balance credited exactly once (FR-DEP-04, AC-06). |
| Tampered payload with reused key | Replaying the same `Idempotency-Key` with altered payload parameters (e.g. modified amount) safely fails with `409 Conflict (IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_PAYLOAD)` and causes zero ledger or balance side-effects. |
| Aborted transaction retry | A transaction that fails/aborts mid-flight does not lock or burn the idempotency key; a subsequent retry with the same key succeeds cleanly. |
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

| Test | Target | Requirement | Measured / Status |
|---|---|---|---|
| Page and lookup requests | < 2 s for 95% | NFR-PERF-01 | Passes in API & UI test suites |
| Deposit / withdrawal posting | < 3 s | NFR-PERF-02 | **p50 = 5.2ms, p95 = 8.4ms, max = 12.1ms** (`tests/db/posting-performance.test.mjs`) |
| Concurrent posting under load & contention | Zero errors / deadlocks, p95 < 3s | NFR-PERF-04 | **36 concurrent ops, p50 = 7.5ms, p95 = 14.2ms, 0 unhandled failures**, 100% ledger reconciled (`tests/db/posting-performance.test.mjs`) |
| Each management report on the sample dataset | < 5 s | NFR-PERF-03 | Reports generate within 50-350ms in test suites |
| Scale probe: 1,000,000 synthetic ledger rows | reports still complete; index plans hold | NFR-PERF-04 | Index scan plans verified |
| `EXPLAIN ANALYZE` for every report & posting query | index scan, not a sequential scan on `transaction` | SRS §6.7 | **Index Scan verified** on `ix_txn_account_date`, `ux_transaction_idempotency`, and `transaction_reference_number_key` (`tests/db/posting-performance.test.mjs`) |

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

## Backup and Restore Evidence

Current evidence comes from the executable isolated dump/restore suite and
[the migration/restore evidence](migration-rollback-evidence.md). It compares all
26 tables by whole-row hashes, exact financial totals, constraints, RLS policies,
ownership and sequence positions after a custom-format dump and restore.
The generated source and restore databases are removed after verification; the
normal development database is preserved. Historical example sizes/logs are not
used as evidence for this branch. Live hosting backup verification remains pending.
