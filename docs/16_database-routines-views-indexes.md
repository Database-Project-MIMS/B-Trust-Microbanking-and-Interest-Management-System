# 16 — Database Routines, Views and Indexes

Implementation inventory. Names are reconciled with our approved schema and the SRS §6.5
routine table. The inventory contains both implemented Phase 1 objects and objects planned
for later phases; the owning migration and task documentation record implementation state.

Each entry states its owner, the requirements it satisfies, and the lecture concept it
demonstrates. That last column matters: grading is tied to demonstrated coverage of
L01–L13.

---

## Stored procedures

### Implemented service-owned customer transactions (P02-M02-T04)

These are TypeScript orchestration functions in `services/customer-service.ts`,
not new stored routines or database objects. Existing migrations 0220–0222 remain unchanged.

| Service | Owner | Boundary and purpose | Requirements | Concepts |
|---|---|---|---|---|
| `registerCustomer` | M2 | One withTransaction: scope/active-staff locks, customer, document metadata, one active assignment and minimal audit; all roll back on failure | FR-CUS-01…05, BR-01 | L11 atomicity, isolation; L07 constraints |
| `searchCustomers` | M2 | One repeatable-read transaction: SQL-scoped filters, count/page, fixed sort allow-list and identity masking | FR-CUS-04/05 | L05 selection/joins, L11 snapshots |
| `getCustomerProfile` | M2 | One repeatable-read transaction: scoped/self customer, all assignment history, document metadata, available account links | FR-CUS-04/05 | L05 joins, L11 snapshots |

181 selected tests and clean rebuild/typecheck/lint pass. Runtime grants/RLS/audit
coordination and API/UI integration remain pending; see the T04 handoff.

### Planned stored procedures

| Routine | Owner | Purpose | Transaction boundary | Requirements | Concepts |
|---|---|---|---|---|---|
| `sp_open_savings_account` | M3 | Validate plan, agent/branch, payload, holders (locked), eligibility, verified documents, mandate and deposit (incl. business hours); then write account, holders (one statement), mandate and optional initial deposit. Migration 0243, `SECURITY INVOKER`. Errors: see below | The caller's — never commits; all or nothing | FR-ACC-01…04, BR-02, BR-07, BR-08 | L08 procedures, L11 atomicity |
| `sp_add_account_holder` | M3 | Add one JOINT holder to an ACTIVE account: lock the account, require an active customer with a verified document; the 0242 trigger enforces count/adult rules and syncs an `ALL_HOLDERS` mandate. Migration 0245, `SECURITY INVOKER`. Errors (`P0001`, named constraint): `ACCOUNT_NOT_FOUND`, `ACCOUNT_NOT_ACTIVE`, `HOLDER_NOT_FOUND`, `DOCUMENTS_NOT_VERIFIED`, `ACTOR_MISMATCH`; `23505` duplicate holder | The caller's — never commits | FR-ACC-02/04, BR-02, BR-07 | L08 procedures, L11 locking |
| `sp_post_deposit` | M4 | Lock account, insert ledger, update balance and `balance_after`, audit, return reference. Migration 0361, standalone routine file `database/routines/sp_post_deposit.sql`. Errors: see below | One, `FOR UPDATE` | FR-DEP-01…05, BR-08, BR-10, BR-I1 | L08, L11 ACID |
| `sp_post_withdrawal` (corrected 0363) | M4 | Invoker core: current actor/scope, serialized payload-bound replay, then locked status/calendar/mandate/Colombo limits/minimum, attributed ledger/balance/success audit. Array signers plus legacy single-customer overload | Caller-owned; account `FOR UPDATE`, per-key advisory lock; never commits | FR-WD-01…05, BR-09/17/I1/I2 | L11 isolation, locking |
| `sp_try_post_withdrawal` (0363) | M4 | Array-signers audited entry; known rejection rolls back inner financial work, writes outer audit and returns `p_rejection_code` | Caller commits audit-only result, then maps error outside withTransaction | FR-WD-05, BR-L1 | L11 subtransactions/atomicity |
| `sp_write_rejection_audit` (corrected 0363) | M4 | CALL writes protected WITHDRAWAL_REJECTED in existing audit_log.new_values | Caller-owned outer transaction; never commits | FR-WD-05, BR-L1 | L11 atomicity |
| `sp_reverse_transaction` | M4 | Insert a linked compensating entry; never modify the original | One, `FOR UPDATE` | FR-TXN-03, BR-16, DB-CON-04 | L08, L11 |
| `sp_open_fixed_deposit` | M5 | Check eligibility under lock, debit principal through the ledger, create the FD with maturity and rate snapshot | One | FR-FD-01…04, BR-11, BR-19 | L08, L11 |
| `sp_run_interest_cycle` | M5 | Create the run, select due FDs with locking, process **each FD in its own transaction**, reconcile totals | **One per FD**, not per run | FR-INT-01…05, NFR-SAFE-03 | L08, L11 idempotency |
| `sp_close_account` | M3 | Require zero balance and no active FD, then close | One | FR-ACC-05, BR-18 | L08 |

**`sp_post_deposit` errors** (all `P0001`, named `CONSTRAINT` for mapping): `ACCOUNT_ID_REQUIRED` (`ck_deposit_account_id`), `INVALID_DEPOSIT_AMOUNT` (`ck_deposit_amount_positive`), `USER_ID_REQUIRED` (`ck_deposit_user_id`), `CHANNEL_REQUIRED` (`ck_deposit_channel_required`), `CHANNEL_UNAVAILABLE` (`ck_deposit_channel_active`), `ACCOUNT_NOT_FOUND` (`ck_deposit_account_exists`), `ACCOUNT_NOT_ACTIVE` (`ck_deposit_account_active`), `OUTSIDE_BUSINESS_HOURS` (`ck_deposit_business_hours`). Idempotent requests with a repeated `idempotency_key` return the existing transaction record without raising or modifying balance.

**Withdrawal correction (0363 / ADR-0021):** core `P0001` errors include `WITHDRAWAL_ID_REQUIRED`, `INVALID_WITHDRAWAL_AMOUNT`, `INVALID_IDEMPOTENCY_KEY`, `INVALID_WITHDRAWAL_NARRATION`, `WITHDRAWAL_NOT_AUTHORIZED`, `ACCOUNT_NOT_FOUND`, `CHANNEL_UNAVAILABLE`, `WITHDRAWAL_CONFIGURATION_INVALID`, `IDEMPOTENCY_KEY_REUSED`, plus the six known financial rejection codes: `ACCOUNT_NOT_ACTIVE`, `OUTSIDE_BUSINESS_HOURS`, `MANDATE_NOT_SATISFIED`, `LIMIT_EXCEEDED`, `INSUFFICIENT_FUNDS`, `BELOW_MINIMUM_BALANCE`. The audited attempt catches only these six, rolls back inner financial effects, CALLs the helper and returns a rejection code with NULL financial outputs. Commit that audit-only result before safe error mapping outside withTransaction. Unexpected errors abort everything. Matching key/payload returns the original result without another effect; altered actor/account/channel/amount/narration/canonical signers cannot reuse a key. All procedures are SECURITY INVOKER with no PUBLIC EXECUTE. The future T05 service validates signer evidence; customer self-service cannot claim another holder signed. [Handoff](../.agent/handoffs/p03-m04-withdrawal-contract-repair.md).

**`sp_open_savings_account` errors** (all `P0001`, message starts with the code, named `CONSTRAINT` for mapping; services must never forward the message): `PLAN_NOT_FOUND`, `AGENT_NOT_ELIGIBLE`, `ACTOR_MISMATCH` (service bug → 500), `INVALID_HOLDER_COUNT`, `INVALID_HOLDERS_PAYLOAD`, `HOLDER_NOT_FOUND`, `MISSING_PRIMARY_HOLDER`, `PLAN_ELIGIBILITY_FAILED`, `DOCUMENTS_NOT_VERIFIED`, `MANDATE_REQUIRED`, `MANDATE_NOT_ALLOWED`, `INVALID_MANDATE_TYPE`, `INVALID_MANDATE_SIGNATORIES`, `INVALID_DEPOSIT_AMOUNT`, `BELOW_MINIMUM_BALANCE`, `OUTSIDE_BUSINESS_HOURS`, `CHANNEL_REQUIRED`, `CHANNEL_NOT_FOUND`; plus 0242 `UNDERAGE_HOLDER` and `23505` for a duplicate holder. Locks taken: plan `FOR SHARE`, holder customers `FOR SHARE` (id order), then the 0242 account lock.

## Functions

| Routine | Owner | Returns | Purpose | Requirements | Concepts |
|---|---|---|---|---|---|
| `fn_calculate_fd_interest(principal, rate)` | M5 | `numeric(15,2)` | `round(principal × rate × 30 / 365, 2)` — exact decimal, reads the **snapshot** rate | FR-INT-01, BR-14, BR-19 | L08 functions |
| `fn_check_plan_eligibility(plan_id, dob, holder_count)` | M3 | `boolean` | Data-driven age and holder-count check against `savings_plan` for the primary applicant only — never raises, returns `false` on any missing plan, inactive plan, or invalid input. Implemented in `database/routines/fn_check_plan_eligibility.sql` (`P01-M03-T02`, `docs/specs/0002-plan-eligibility-function.md`) | FR-ACC-02, BR-E1 | L05, L08 |
| `fn_check_plan_minimum(account_id, resulting_balance)` | M3 | `boolean` | **I-4.** `true` when the balance **after** the withdrawal (`current_balance - amount`, not the debit) is ≥ the plan's `min_balance`, read via `account.plan_id`. SECURITY INVOKER, STABLE, never raises: unknown/NULL account, NULL balance or an RLS-hidden account returns `false`. Call after `SELECT … FOR UPDATE` and before the ledger insert. Implemented in `database/routines/fn_check_plan_minimum.sql` (`P03-M03-T01`; `tests/db/fn-check-plan-minimum.test.mjs`) | FR-ACC-03, BR-09 | L05, L08 |
| `fn_check_withdrawal_mandate(account_id, signer_customer_ids uuid[])` | M3 | `boolean` | **I-4.** `true` when every distinct signer is a current holder and the stored `joint_mandate` is satisfied: `ANY_ONE` needs one holder, `ALL_HOLDERS` needs every holder; no mandate is valid only for an account with exactly one holder (the account's actual holders, not the plan's `max_holders`). A mandate outside `effective_from/to`, an empty/NULL array, a NULL element, a non-holder signer or an unknown/RLS-hidden account returns `false`. SECURITY INVOKER, STABLE, never raises. Call after `SELECT … FOR UPDATE` and before the ledger insert; `false` → `MANDATE_NOT_SATISFIED`. Implemented in `database/routines/fn_check_withdrawal_mandate.sql` (`P03-M03-T02`; `tests/db/fn-check-withdrawal-mandate.test.mjs`) | FR-WD-02, BR-17 | L05, L08 |
| `fn_withdrawal_mandate_verdict(account_id, signer_customer_ids uuid[])` | M3 | `text` | Reason behind `fn_check_withdrawal_mandate` for M4's rejection audit: `OK`, `NO_SIGNERS`, `ACCOUNT_NOT_FOUND` (also RLS-hidden), `SIGNER_NOT_HOLDER`, `MANDATE_MISSING`, `MANDATE_NOT_EFFECTIVE`, `MANDATE_NOT_SATISFIED`. Same file as `fn_check_withdrawal_mandate`; never raises; mandate dates use the Asia/Colombo calendar date | FR-WD-02, FR-WD-05, BR-17 | L05, L08 |
| `fn_next_account_number(branch_code)` | M3 | `varchar` | `<BRANCH_CODE>-<8-digit>` from `account_number_seq` (migration 0243); unique under concurrency, gaps after rollback expected; blank code rejected; from migration 0246 it skips numbers already used by directly inserted (seed) accounts, `SECURITY DEFINER` so RLS cannot hide them | FR-ACC-01 | L03 sequences |
| `fn_next_transaction_reference()` | M4 | `varchar` | Unique transaction reference (BR-10) | FR-DEP-02 | L03 |
| `fn_is_business_hour(ts)` | M1 | `boolean` | Reads `business_calendar` / `system_parameter` | BR-08 | L05 |
| `fn_check_business_hours(check_ts timestamptz)` | M1 | `boolean` | **P03-M01-T01.** Thin wrapper around `fn_is_business_hour(now())`; `false` → reject with `OUTSIDE_BUSINESS_HOURS`. Migration `0300`. | BR-08 | L05, L08 |
| `fn_get_parameter(key varchar)` | M1 | `varchar \| null` | **P03-M01-T01.** Reads one `system_parameter` value; STABLE; returns NULL for unknown keys. Migration `0300`. | BR-08, BR-I2 | L05 |
| `fn_check_withdrawal_single_limit(amount numeric)` | M1 | `boolean` | **P03-M01-T01.** `false` when `amount > WITHDRAWAL_SINGLE_LIMIT`; also `false` for NULL input; `true` if parameter is not configured. Call after account lock, before ledger insert. Migration `0300`. | BR-I2 | L05, L08 |
| `fn_check_withdrawal_daily_limit(account_id uuid, amount numeric)` | M1 | `boolean` | **P03-M01-T01.** Sums today's `WITHDRAWAL` rows for the account (Asia/Colombo date) and checks `(used + amount) <= WITHDRAWAL_DAILY_LIMIT`. `false` for NULL inputs; `true` if parameter not configured. Call after account lock. Migration `0300`. | BR-I2 | L05, L08 |
| `fn_account_running_balance(account_id)` | M4 | table | Window-function running balance, used to reconcile `balance_after` | FR-TXN-04 | **L13 window functions** |
| `fn_validate_agent_active_branch()` | M2 | `trigger` | Lock and verify that an active agent references an active branch | FR-ORG-02 | L08 triggers, L11 locking |
| `fn_prevent_account_branch_change()` | M3 | `trigger` | Reject any change to `account.branch_id` after opening | ADR-0008, D-4 | L08 triggers |
| `fn_prevent_branch_deactivation_with_active_agents()` | M2 | `trigger` | Reject branch deactivation while active agents remain | FR-ORG-02 | L08 triggers |
| `fn_rls_is_bank_wide()`, `fn_rls_in_branch()`, `fn_rls_can_write()`, etc. | M1 | `boolean`/`uuid` | Read context variables (`app.current_user_id`, etc.) set by `rls-context.ts` for fail-closed RLS policies | NFR-SEC-07 | L08 functions, security |
| `fn_audit_master_changes()` | M1 | `trigger` | Reusable trigger function for audit logging; calls `fn_mask_audit_values()` | FR-ORG-04 | L08 triggers, `jsonb` |
| `fn_mask_audit_values(payload)` | M1 | `jsonb` | Strips `nic_passport_no`, `email`, `password_hash`, etc. from audit rows | NFR-SEC-05 | L08, `jsonb` |

## Triggers

| Trigger | Owner | Timing | Purpose | Requirements | Concepts |
|---|---|---|---|---|---|
| `trg_financial_transaction_immutable` | M4 | `BEFORE UPDATE OR DELETE` on `transaction` | Raise unconditionally — posted rows are immutable | FR-TXN-02, BR-16 | L08 triggers |
| `trg_audit_log_immutable` | M1 | `BEFORE UPDATE OR DELETE` on `audit_log` | Append-only audit | FR-AUD-01 | L08 |
| `trg_audit_master_changes` | M1/M2 | `AFTER INSERT/UPDATE/DELETE` on master tables | Write sanitized before/after values as `jsonb`; sensitive keys are removed | FR-ORG-04, DB-CON-06 | L08, `jsonb` |
| `trg_audit_customer`, `trg_audit_account`, `trg_audit_account_holder` | M1 | `AFTER INSERT/UPDATE` on `customer`, `account`, `account_holder` | Audit master data in the caller transaction, capturing session context via RLS helpers | FR-ORG-04, NFR-SEC-05 | L08, ACID |
| `trg_audit_branch` / `trg_audit_agent` | M2 | `AFTER INSERT/UPDATE/DELETE` on `branch` / `agent` | Audit organisation master data in the caller transaction | FR-ORG-04, FR-AUD-01 | L08, ACID |
| `trg_validate_joint_mandate`, `trg_validate_joint_mandate_update` | M3 | `AFTER INSERT` / `AFTER UPDATE` on `account_holder`, **statement-level with transition tables** (wrappers `fn_trg_account_holder_inserted/updated` → `fn_check_account_holder_sets`, `SECURITY DEFINER`, `EXECUTE` revoked from `PUBLIC`; migration 0242) | Lock the account (`FOR NO KEY UPDATE`), then holder count within the plan's `min_holders`/`max_holders`, exactly one `PRIMARY`, no holder under 18 when `requires_all_adult` — read from `savings_plan`, never from the plan name; keeps an `ALL_HOLDERS` mandate's signatories equal to the holder count | FR-ACC-04, BR-07, BR-17 | **L08 statement-level triggers, transition tables** |
| `trg_joint_mandate_fit` | M3 | `AFTER INSERT OR UPDATE OF account_id, mandate_type, required_signatories` on `joint_mandate`, row-level (function `fn_validate_joint_mandate_fit`; migration 0242) | Mandate only on multi-holder plans; signatories ≤ holders; `ALL_HOLDERS` = holder count | FR-ACC-04, BR-17 | L08 |
| `trg_joint_mandate_set_updated_at` | M3 | `BEFORE UPDATE` on `joint_mandate` | Maintain modification timestamp | DB-CON-06 | L08 |
| `trg_set_updated_at` | shared | `BEFORE UPDATE` | Maintain `updated_at` | DB-CON-06 | L08 (already in migration `0000`) |
| `trg_prevent_duplicate_active_fd` | M5 | `BEFORE INSERT/UPDATE` on `fixed_deposit` | **Fallback only.** The partial unique index is the real guarantee; this exists so the rule is also demonstrable as a trigger | BR-12, NFR-SAFE-04 | L08, L10 |
| `trg_validate_agent_active_branch` | M2 | `BEFORE INSERT OR UPDATE OF branch_id, status` on `agent` | Require every active agent's branch to be active | FR-ORG-02 | L08, L11 locking |
| `trg_branch_prevent_deactivation_with_active_agents` | M2 | `BEFORE UPDATE OF status` on `branch` | Preserve the active-agent/active-branch invariant in the reverse direction | FR-ORG-02 | L08 |
| `trg_account_prevent_branch_change` | M3 | `BEFORE UPDATE OF branch_id` on `account` | Owning branch is a snapshot taken at opening; never changes | ADR-0008, D-4 | L08 |
| `trg_account_set_updated_at` | M3 | `BEFORE UPDATE` on `account` | Maintain the account modification timestamp | DB-CON-06 | L08 |
| `trg_agent_set_updated_at` | M2 | `BEFORE UPDATE` on `agent` | Maintain the agent modification timestamp | DB-CON-06 | L08 |
| `trg_customer_set_updated_at` | M2 | `BEFORE UPDATE` on `customer` | Maintain customer modification timestamp; migration 0220 | DB-CON-06, P02-M02-T01 | L08 |
| `trg_customer_agent_set_updated_at` | M2 | `BEFORE UPDATE` on `customer_agent` | Maintain assignment modification timestamp; 0221 | DB-CON-06, P02-M02-T02 | L08 |
| `trg_customer_document_set_updated_at` | M2 | `BEFORE UPDATE` on `customer_document` | Maintain document modification timestamp; 0222 | DB-CON-06, P02-M02-T03 | L08 |

> **Design note.** Where a constraint or index can enforce a rule, it does — a partial
> unique index is atomic, race-free and cheaper than a trigger. Triggers are used for
> immutability, audit, and multi-row rules that constraints genuinely cannot express
> (AGENTS.md §5: avoid putting all business logic in triggers).

## Views

| View | Owner | Purpose | Report | Concepts |
|---|---|---|---|---|
| `vw_account_balance` | M3 | Account with plan, branch, holders and balance | RPT-02 | L05 joins |
| `vw_transaction_detail` | M4 | Ledger joined to account, agent, branch, channel and reversal status | several | L05 |
| `vw_rpt01_agent_transactions` (implemented 0520; supersedes planned `vw_agent_transaction_totals` name) | M2 | **RPT-01** — exact counts/unsigned values per agent, posting branch, type and timestamp; range filters precede final totals | RPT-01, FR-REP-02 | L05 outer joins, aggregation, `GROUP BY`; L10 agent/date index |
| `vw_account_transaction_summary` | M3 | **RPT-02** — opening/closing balance, counts and totals by type | RPT-02 | L13 window functions |
| `vw_active_fd_schedule` | M5 | **RPT-03** — active FDs with next payout and maturity | RPT-03 | L05 |
| `vw_monthly_interest_distribution` | M5 | **RPT-04** — distributions per cycle per account type, with subtotals | RPT-04 | **L13 `ROLLUP` / `GROUPING SETS`** |
| `vw_customer_activity` | M4 | **RPT-05** — deposits, withdrawals, interest and net movement per customer | RPT-05 | L05, L13 |
| `vw_ledger_reconciliation` | M4 | Asserts `current_balance` = signed ledger sum = last `balance_after` | reconciliation | L11 consistency |
| `vw_interest_run_summary` | M5 | Run counts, totals and exceptions | audit | L05 |
| `vw_customer_account_holdings` | M2 | Customers with their accounts, including joint | RPT-05 | L05 outer joins |
| `vw_customer_fd_summary` (implemented 0420) | M2 | Customer→holder→account→FD/product; all statuses, exact snapshot values, caller RLS | customer profile | L05 joins, L07 privileges, L11 read snapshot |

Reporting views are queried with branch-scope predicates in the calling service
(REP-COM-02). The implemented customer FD listing view additionally enforces caller
RLS/assignment/self scope at the database boundary (ADR-0018).

`fn_install_customer_fd_summary()` is an owner-only SECURITY INVOKER bootstrap in
0420, revoked from PUBLIC/mims_app. It idempotently binds the view and SELECT-only FD
policy/column grants after 0480 through database/views/customer-fd-summary.sql.
No financial routine or new index is introduced. M1/M5 handoff records this boundary.

P04-M02-T02 adds `fn_customer_fd_actor_is_current()` (0421), STABLE SECURITY INVOKER
boolean checking active stored identity/role/profile/branch against transaction
context. `fn_install_customer_fd_scope_guard()` is an owner-only invoker bootstrap
for the additive RESTRICTIVE SELECT policy, invoked after 0420 by the same views
binder. Missing/stale context fails closed; current row scope remains ANDed. No
financial routine, view columns or index changes. ADR-0019; M1/M5 scope handoff.

RPT-01 migration 0520 uses COUNT(transaction_id) and unbounded NUMERIC SUM at
posting timestamp/type/branch grain. It includes zero rows for profiles without
attributed history; selected-range zeros require the filtered-facts roster outer
join documented in M2's task card. No current-role/status filter erases history.
The SECURITY INVOKER/BARRIER view remains private. Migration0521 adds scoped
execute-only readers and service-owned auditing under ADR-0022. Reuse existing
`ix_transaction_agent_date`; a selective view query's measured plan is recorded in
the T01 handoff. The final 0521 function probe with 20,000 extra postings took
6.826 ms; its wrapper plan is a Function Scan, not proof that every internal
bankwide query uses an index. M5 retains representative bankwide tuning/review.

| Routine | Owner | Security / return | Enforcement | Course concepts |
|---|---|---|---|---|
| `fn_rpt01_scope(uuid)` | M2 | STABLE INVOKER; effective branch UUID | Current active stored report actor, manager profile/branch/context; rejects widened scope | L08, L11 access control |
| `fn_rpt01_rows(date,date,uuid,uuid)` | M2 | STABLE DEFINER; fixed agent/posting-branch aggregates | Guarded dates/scope, filtered roster outer join, exact NUMERIC/counts, linked reversal direction and unresolved net | L05 joins/aggregation; L10 indexes; L11 least privilege |
| `fn_rpt01_exclusions(date,date,uuid)` | M2 | STABLE DEFINER; bigint count + NUMERIC unsigned value | Same guard and branch/date predicates; NULL-agent disclosure independently of agent filter | L05 aggregate; L11 scope |

All three pin search_path and revoke PUBLIC EXECUTE; mims_app receives EXECUTE.
Relations are fully qualified and no dynamic SQL or raw ledger DTO is exposed.
0520 stays unchanged/private. The live service materializes rows/totals and writes
REPORT_ACCESSED in REPEATABLE READ, then streams CSV after commit.

## Indexes

Every index states the query it serves. **No index is created without a query that needs
it** — `EXPLAIN` evidence is collected in `P05-M05-T04`.

### Unique / integrity

| Index | Table | Purpose | Requirement |
|---|---|---|---|
| `ux_account_number` (`uq_account_account_number`) | `account` | Lookup and duplicate prevention | SRS §6.7, FR-ACC-01 |
| `ux_transaction_reference` | `transaction` | Unique reference (BR-10) | §6.7, G-05 |
| `ux_transaction_idempotency` (partial, `WHERE key IS NOT NULL`) | `transaction` | Retry safety | FR-DEP-04, G-04 |
| `ux_fixed_deposit_one_active` (partial, `WHERE status='ACTIVE'`) | `fixed_deposit` | One active FD | BR-12, G-01 |
| `ux_interest_payout_fd_cycle` | `interest_payout` | `(fd_id, cycle_date)` — the interest idempotency guarantee | FR-INT-03, §6.7 |
| `ux_customer_agent_one_active` (partial, `WHERE is_active`) | `customer_agent` | At most one current agent; implemented in 0221 | FR-CUS-02, G-10 |
| `ux_customer_nic` | `customer` | Duplicate-identity detection | §6.7, FR-CUS-04 |
| `ux_username` | `app_user` | Sign-in lookup | FR-AUTH-01 |
| `ux_transaction_reversal_original` | `transaction_reversal` | Reversible exactly once | DB-CON-04 |

### Performance

| Index | Table | Serves |
|---|---|---|
| `ix_transaction_account_date` `(account_id, transaction_date DESC)` | `transaction` | Statements, RPT-02 |
| `ix_transaction_agent_date` B-tree `(agent_id, transaction_date)` | `transaction` | Implemented 0320, P03-M02-T01: agent equality + business-date range for **RPT-01** (§6.7) and agent FK lookup |
| `ix_transaction_branch_date` B-tree `(branch_id, transaction_date)` | `transaction` | Implemented 0320: historical branch equality + business-date range and branch FK lookup; does not itself enforce scope/RLS |
| `ix_transaction_type_date` `(transaction_type, transaction_date)` | `transaction` | RPT-04, filters |
| `ix_fd_status_next_interest` `(status, next_interest_date)` | `fixed_deposit` | Selecting FDs due for interest (§6.7) |
| `ix_audit_actor_time` `(user_id, logged_at DESC)` | `audit_log` | Security investigation (§6.7) |
| `ix_audit_entity` `(entity_type, entity_id)` | `audit_log` | Entity history (§6.7) |
| `ix_account_branch_status` `(branch_id, status)` | `account` | Branch-scoped listing |
| `ix_account_holder_customer` `(customer_id)` | `account_holder` | "My accounts", RPT-05 |
| `ix_customer_full_name_trgm` GIN `(full_name gin_trgm_ops)` | `customer` | Fuzzy (%) and substring ILIKE name search; implemented in 0220 — **L10 non-B-tree index** |
| `ix_customer_branch` B-tree `(branch_id)` | `customer` | Branch-scoped customer list/search and branch FK lookup; implemented in 0220 |
| `ix_customer_agent_customer` `(customer_id)` | `customer_agent` | Full assignment history and FK lookup, including inactive rows; 0221 |
| `ix_customer_agent_agent` `(agent_id)` | `customer_agent` | Assigned customer lists and agent FK lookup; 0221 |
| `ix_customer_document_customer` `(customer_id)` | `customer_document` | Customer profile/documents and opening eligibility/FK lookup; 0222 |
| `ix_agent_branch_status` `(branch_id, status)` | `agent` | Branch-scoped active-agent listing |

**Approximately 20 indexes.** Index choice, B-tree vs GIN, and selectivity are covered by
L09/L10; each `indexes/*.sql` file records the `EXPLAIN` plan before and after.

## Database roles and RLS — M1

P02-M02-T03's server service verifyDocument uses one withTransaction for paired
verification plus explicit minimal audit; row locking serializes verification retries.
It sets local app.current_user_id/app.current_branch_id for future M1 policies.
0221/0222 do not grant runtime child-table access. Generic child/customer audit bindings
are M1-owned; the explicit verification audit does not cover arbitrary SQL mutations.
T05's new 0223 grants scoped child SELECT/INSERT with RLS; no child UPDATE/DELETE.
M1's merged customer audit binding supplies registration's sole sanitized INSERT event,
using the shared transaction-local RLS context. No routine, view or index is added by T05.

| Object | Purpose |
|---|---|
| Role `mims_owner` | Schema owner. Used only by migrations. |
| Role `mims_app` | Runtime. `SELECT/INSERT/UPDATE` on operational tables; **no `DELETE` on `transaction` or `audit_log`; no `UPDATE` on `transaction`; no `DROP`** (NFR-SEC-03) |
| Role `mims_readonly` | Auditor/reporting `SELECT` only |
| RLS on `customer`, `account`, `transaction` | Branch and holder scope enforced by the database regardless of application bugs (NFR-SEC-07) |

## Lecture concept coverage

| Concept | Where it is demonstrated |
|---|---|
| L02 ER model, subtypes, intersection entities | `agent` subtype; independent customer with optional login (ADR-0007); `account_holder`, `customer_agent` |
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
