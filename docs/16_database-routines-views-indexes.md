# 16 — Database Routines, Views and Indexes

Implementation inventory. Names are reconciled with our approved schema and the SRS §6.5
routine table. The inventory contains both implemented Phase 1 objects and objects planned
for later phases; the owning migration and task documentation record implementation state.

Each entry states its owner, the requirements it satisfies, and the lecture concept it
demonstrates. That last column matters: grading is tied to demonstrated coverage of
L01–L13.

---

## Stored procedures

| Routine | Owner | Purpose | Transaction boundary | Requirements | Concepts |
|---|---|---|---|---|---|
| `sp_open_savings_account` | M3 | Validate plan, ages and holder count; create account, holders, mandate and optional initial deposit | One — all or nothing | FR-ACC-01…04, BR-02, BR-07 | L08 procedures, L11 atomicity |
| `sp_post_deposit` | M4 | Lock account, insert ledger, update balance and `balance_after`, audit, return reference | One, `FOR UPDATE` | FR-DEP-01…05, BR-10 | L08, L11 ACID |
| `sp_post_withdrawal` | M4 | Re-validate status, mandate, hours, limits and minimum **after** the lock; then debit | One, `FOR UPDATE` | FR-WD-01…05, BR-09, NFR-SAFE-01/02 | L11 isolation, locking |
| `sp_reverse_transaction` | M4 | Insert a linked compensating entry; never modify the original | One, `FOR UPDATE` | FR-TXN-03, BR-16, DB-CON-04 | L08, L11 |
| `sp_open_fixed_deposit` | M5 | Check eligibility under lock, debit principal through the ledger, create the FD with maturity and rate snapshot | One | FR-FD-01…04, BR-11, BR-19 | L08, L11 |
| `sp_run_interest_cycle` | M5 | Create the run, select due FDs with locking, process **each FD in its own transaction**, reconcile totals | **One per FD**, not per run | FR-INT-01…05, NFR-SAFE-03 | L08, L11 idempotency |
| `sp_close_account` | M3 | Require zero balance and no active FD, then close | One | FR-ACC-05, BR-18 | L08 |

## Functions

| Routine | Owner | Returns | Purpose | Requirements | Concepts |
|---|---|---|---|---|---|
| `fn_calculate_fd_interest(principal, rate)` | M5 | `numeric(15,2)` | `round(principal × rate × 30 / 365, 2)` — exact decimal, reads the **snapshot** rate | FR-INT-01, BR-14, BR-19 | L08 functions |
| `fn_check_plan_eligibility(plan_id, dob, holder_count)` | M3 | `boolean` | Data-driven age and holder-count check against `savings_plan` | FR-ACC-02, BR-E1 | L05, L08 |
| `fn_check_plan_minimum(account_id, proposed_debit)` | M3 | `boolean` | Post-withdrawal balance ≥ plan minimum | FR-ACC-03, BR-09 | L05, L08 |
| `fn_next_account_number(branch_code)` | M3 | `varchar` | Sequential, unique, branch-prefixed account number | FR-ACC-01 | L03 sequences |
| `fn_next_transaction_reference()` | M4 | `varchar` | Unique transaction reference (BR-10) | FR-DEP-02 | L03 |
| `fn_is_business_hour(ts)` | M1 | `boolean` | Reads `business_calendar` / `system_parameter` | BR-08 | L05 |
| `fn_account_running_balance(account_id)` | M4 | table | Window-function running balance, used to reconcile `balance_after` | FR-TXN-04 | **L13 window functions** |
| `fn_validate_agent_active_branch()` | M2 | `trigger` | Lock and verify that an active agent references an active branch | FR-ORG-02 | L08 triggers, L11 locking |
| `fn_prevent_branch_deactivation_with_active_agents()` | M2 | `trigger` | Reject branch deactivation while active agents remain | FR-ORG-02 | L08 triggers |

## Triggers

| Trigger | Owner | Timing | Purpose | Requirements | Concepts |
|---|---|---|---|---|---|
| `trg_financial_transaction_immutable` | M4 | `BEFORE UPDATE OR DELETE` on `transaction` | Raise unconditionally — posted rows are immutable | FR-TXN-02, BR-16 | L08 triggers |
| `trg_audit_log_immutable` | M1 | `BEFORE UPDATE OR DELETE` on `audit_log` | Append-only audit | FR-AUD-01 | L08 |
| `trg_audit_master_changes` | M1 | `AFTER INSERT/UPDATE/DELETE` on master tables | Write before/after values as `jsonb` | FR-ORG-04, DB-CON-06 | L08, `jsonb` |
| `trg_validate_joint_mandate` | M3 | `AFTER INSERT/UPDATE` on `account_holder`, **statement-level with transition tables** | Holder count 2–4 and all adults for joint plans — a rule that spans rows, so it cannot be a row `CHECK` | FR-ACC-04, BR-07, BR-17 | **L08 statement-level triggers, transition tables** |
| `trg_set_updated_at` | shared | `BEFORE UPDATE` | Maintain `updated_at` | DB-CON-06 | L08 (already in migration `0000`) |
| `trg_prevent_duplicate_active_fd` | M5 | `BEFORE INSERT/UPDATE` on `fixed_deposit` | **Fallback only.** The partial unique index is the real guarantee; this exists so the rule is also demonstrable as a trigger | BR-12, NFR-SAFE-04 | L08, L10 |
| `trg_validate_agent_active_branch` | M2 | `BEFORE INSERT OR UPDATE OF branch_id, status` on `agent` | Require every active agent's branch to be active | FR-ORG-02 | L08, L11 locking |
| `trg_branch_prevent_deactivation_with_active_agents` | M2 | `BEFORE UPDATE OF status` on `branch` | Preserve the active-agent/active-branch invariant in the reverse direction | FR-ORG-02 | L08 |
| `trg_agent_set_updated_at` | M2 | `BEFORE UPDATE` on `agent` | Maintain the agent modification timestamp | DB-CON-06 | L08 |

> **Design note.** Where a constraint or index can enforce a rule, it does — a partial
> unique index is atomic, race-free and cheaper than a trigger. Triggers are used for
> immutability, audit, and multi-row rules that constraints genuinely cannot express
> (AGENTS.md §5: avoid putting all business logic in triggers).

## Views

| View | Owner | Purpose | Report | Concepts |
|---|---|---|---|---|
| `vw_account_balance` | M3 | Account with plan, branch, holders and balance | RPT-02 | L05 joins |
| `vw_transaction_detail` | M4 | Ledger joined to account, agent, branch, channel and reversal status | several | L05 |
| `vw_agent_transaction_totals` | M2 | **RPT-01** — counts and values per agent by type | RPT-01 | L05 aggregation, `GROUP BY` |
| `vw_account_transaction_summary` | M3 | **RPT-02** — opening/closing balance, counts and totals by type | RPT-02 | L13 window functions |
| `vw_active_fd_schedule` | M5 | **RPT-03** — active FDs with next payout and maturity | RPT-03 | L05 |
| `vw_monthly_interest_distribution` | M5 | **RPT-04** — distributions per cycle per account type, with subtotals | RPT-04 | **L13 `ROLLUP` / `GROUPING SETS`** |
| `vw_customer_activity` | M4 | **RPT-05** — deposits, withdrawals, interest and net movement per customer | RPT-05 | L05, L13 |
| `vw_ledger_reconciliation` | M4 | Asserts `current_balance` = signed ledger sum = last `balance_after` | reconciliation | L11 consistency |
| `vw_interest_run_summary` | M5 | Run counts, totals and exceptions | audit | L05 |
| `vw_customer_account_holdings` | M2 | Customers with their accounts, including joint | RPT-05 | L05 outer joins |

Views are read-only, carry no scope filter of their own, and are always queried with the
branch-scope predicate applied by the calling service (REP-COM-02).

## Indexes

Every index states the query it serves. **No index is created without a query that needs
it** — `EXPLAIN` evidence is collected in `P05-M05-T04`.

### Unique / integrity

| Index | Table | Purpose | Requirement |
|---|---|---|---|
| `ux_account_number` | `account` | Lookup and duplicate prevention | SRS §6.7, FR-ACC-01 |
| `ux_transaction_reference` | `transaction` | Unique reference (BR-10) | §6.7, G-05 |
| `ux_transaction_idempotency` (partial, `WHERE key IS NOT NULL`) | `transaction` | Retry safety | FR-DEP-04, G-04 |
| `ux_fixed_deposit_one_active` (partial, `WHERE status='ACTIVE'`) | `fixed_deposit` | One active FD | BR-12, G-01 |
| `ux_interest_payout_fd_cycle` | `interest_payout` | `(fd_id, cycle_date)` — the interest idempotency guarantee | FR-INT-03, §6.7 |
| `ux_customer_agent_one_active` (partial, `WHERE is_active`) | `customer_agent` | One current agent per customer | FR-CUS-02, G-10 |
| `ux_customer_nic` | `customer` | Duplicate-identity detection | §6.7, FR-CUS-04 |
| `ux_username` | `app_user` | Sign-in lookup | FR-AUTH-01 |
| `ux_transaction_reversal_original` | `transaction_reversal` | Reversible exactly once | DB-CON-04 |

### Performance

| Index | Table | Serves |
|---|---|---|
| `ix_transaction_account_date` `(account_id, transaction_date DESC)` | `transaction` | Statements, RPT-02 |
| `ix_transaction_agent_date` `(agent_id, transaction_date)` | `transaction` | **RPT-01** (§6.7) |
| `ix_transaction_branch_date` `(branch_id, transaction_date)` | `transaction` | Branch reporting, RLS |
| `ix_transaction_type_date` `(transaction_type, transaction_date)` | `transaction` | RPT-04, filters |
| `ix_fd_status_next_interest` `(status, next_interest_date)` | `fixed_deposit` | Selecting FDs due for interest (§6.7) |
| `ix_audit_actor_time` `(user_id, logged_at DESC)` | `audit_log` | Security investigation (§6.7) |
| `ix_audit_entity` `(entity_type, entity_id)` | `audit_log` | Entity history (§6.7) |
| `ix_account_branch_status` `(branch_id, status)` | `account` | Branch-scoped listing |
| `ix_account_holder_customer` `(customer_id)` | `account_holder` | "My accounts", RPT-05 |
| `ix_customer_name_trgm` GIN `(full_name gin_trgm_ops)` | `customer` | Fuzzy name search — **L10 non-B-tree index** |
| `ix_agent_branch_status` `(branch_id, status)` | `agent` | Branch-scoped active-agent listing |

**Approximately 20 indexes.** Index choice, B-tree vs GIN, and selectivity are covered by
L09/L10; each `indexes/*.sql` file records the `EXPLAIN` plan before and after.

## Database roles and RLS — M1

| Object | Purpose |
|---|---|
| Role `mims_owner` | Schema owner. Used only by migrations. |
| Role `mims_app` | Runtime. `SELECT/INSERT/UPDATE` on operational tables; **no `DELETE` on `transaction` or `audit_log`; no `UPDATE` on `transaction`; no `DROP`** (NFR-SEC-03) |
| Role `mims_readonly` | Auditor/reporting `SELECT` only |
| RLS on `customer`, `account`, `transaction` | Branch and holder scope enforced by the database regardless of application bugs (NFR-SEC-07) |

## Lecture concept coverage

| Concept | Where it is demonstrated |
|---|---|
| L02 ER model, subtypes, intersection entities | `agent`/`customer` subtypes; `account_holder`, `customer_agent` |
| L03 DDL, sequences, basic SQL | All migrations; reference/number generators |
| L04/L06 Normalisation to 3NF, documented denormalisation | `04_database-schema.md` §B.5, §B.6 |
| L05 Joins, aggregation, views, constraints | All 10 views; `CHECK`/`UNIQUE`/FK throughout |
| L07 Application/database boundary, injection defence | `lib/db`, parameterized SQL, `allowListed()` |
| L08 Procedures, functions, triggers, statement-level triggers with transition tables | 7 procedures, 9 functions, 9 triggers |
| L09/L10 Storage, indexing, B-tree vs GIN, partial indexes | 19 indexes incl. 5 partial and 1 GIN |
| L11 Transactions, ACID, isolation, locking, deadlock avoidance | `withTransaction`, `FOR UPDATE`, per-FD interest transactions |
| L13 Analytics: window functions, `ROLLUP`/`GROUPING SETS` | `vw_account_transaction_summary`, `vw_monthly_interest_distribution`, `fn_account_running_balance` |

L01 (introduction) and L12 (big data) are contextual; L12 is addressed in
`12_testing-and-acceptance.md` under the one-million-row scalability target
(NFR-PERF-04).
