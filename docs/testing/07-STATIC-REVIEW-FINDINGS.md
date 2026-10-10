# 07 — Static Review Findings

Problems found while reading the code on `dev` (HEAD `b38150e`, 2026-10-09) to write this
test package. **Nothing has been fixed.** Use this list to decide what to fix before the
demo, and to know which test cases in 04–06 will probably fail.

- **Severity:**
  - **Critical** — breaks a core financial guarantee or a core workflow.
  - **High** — security, data integrity or a major feature gap.
  - **Medium** — wrong behaviour, missing validation, inconsistency.
  - **Low** — code quality, docs, convention.
- **Confidence:**
  - **Confirmed** — reproduced, or certain from the code.
  - **Very likely** — the code path is clear but was not run.
  - **Needs confirmation** — depends on runtime behaviour; a test case in 04–06 will settle
    it.
- **Likely owner** is the slice owner. For Member 4 features that someone else
  implemented, the implementer is shown as "(implemented by …)". The owner is responsible
  for the fix decision; the implementer knows the code best.
- Every finding gives `file:line`. Test IDs show where the finding is exercised.

---

## 1. Results of automated checks (run 2026-10-09 on macOS, Node 20.20.2, PostgreSQL 16.15)

| Check | Command | Result |
|---|---|---|
| TypeScript | `npx tsc --noEmit` | **PASS** (exit 0, no errors) |
| ESLint | `npx eslint .` | **PASS** (exit 0, no warnings). Note the config only enables Next.js core-web-vitals rules (F-46) |
| Production build | `npx next build` | **PASS** (Next.js 15.5.25, "Compiled successfully", no warnings). All 37 API routes and all pages built |
| Existing test suite | `LC_ALL=en_US.UTF-8 npm test` | **Not run yet** — waiting for the team's go-ahead (see 00 → "Existing test suite"). It uses a throwaway PostgreSQL cluster, not `mims_dev`. Last recorded result in `.agent/current-state.md`: 1062 tests / 98 suites passing (2026-10-09, M2's run) |
| Overload experiment | Toy procedures in a throwaway cluster, called through node-pg like `transaction-service.ts` | Reproduced `42725 procedure p(unknown, unknown, unknown, unknown) is not unique` (evidence for F-01) |

The project pins Node 22 in `.nvmrc`; Node 20 satisfies `engines`.

---

## 2. Summary

| Severity | Count | IDs |
|---|---|---|
| Critical | 2 | F-01, F-02 |
| High | 12 | F-03 … F-10, F-12, F-25, F-26, F-36 |
| Medium | 21 | F-11, F-13 … F-17, F-20, F-23, F-24, F-27 … F-35, F-37, F-38, F-58 |
| Low | 23 | F-18, F-19, F-21, F-22, F-39 … F-57 |

**Top 10 to look at before the demo:** F-01, F-02, F-12, F-03, F-07, F-25, F-08, F-09,
F-10, F-26.

By likely owner (counting a shared finding once per owner):

| Owner | Findings |
|---|---|
| Nadija | F-08, F-11, F-13, F-17, F-18, F-19, F-20, F-37, F-38, F-39, F-42, F-43, F-44, F-46, F-47, F-49, F-51, F-55, F-56 |
| Vibodha | F-07, F-52 |
| Nisith | F-11 (plans), F-40 |
| Pramudith (some implemented by Selith or Nadija) | F-01, F-02, F-03, F-04, F-05, F-06, F-10, F-12, F-14, F-15, F-16, F-24, F-27, F-28, F-31, F-34, F-45, F-48, F-53, F-58 |
| Selith | F-09, F-11 (FD products), F-21, F-23, F-25, F-26, F-29, F-30, F-32, F-33, F-35, F-41, F-50, F-54, F-57 |
| Shared / all | F-22, F-36 |

---

## 3. Critical

### F-01 — Withdrawal API fails on every call (ambiguous procedure overload)
- **Severity:** Critical · **Confidence:** Confirmed by experiment (not yet run against
  the real schema).
- **Where:** `services/transaction-service.ts:79-85` sends
  `CALL sp_post_withdrawal($1,…,$7, NULL×4)` with untyped parameters.
  `database/migrations/0363_p03_m04_withdrawal_contract_repair.sql:17` (`uuid[]`) and `:186`
  (`uuid`) define two overloads that differ only in parameter 5.
- **What happens:** node-pg sends parameters as `unknown`, so PostgreSQL cannot choose an
  overload: `42725 … is not unique`. `lib/db/errors.ts:202` maps that to
  `500 UNEXPECTED_DB_ERROR`. The DB tests cast explicitly (`$5::uuid[]`), and
  `tests/api/withdrawals.test.mjs` is `assert.ok(true)`, so nothing caught it.
- **Impact:** no withdrawal can be posted through the app. AC-05 and the demo's withdrawal
  steps fail.
- **Tests:** WF-TXN-05…11, API-TXN-07…14.
- **Likely owner:** Pramudith (implemented by Selith; `0363` repair by Vibodha).
- **Fix direction:** cast in SQL (`$5::uuid[]` with `ARRAY[...]`), or drop the legacy
  overload.

### F-02 — Cross-branch reversal writes a ledger row but never changes the balance
- **Severity:** Critical · **Confidence:** Very likely.
- **Where:** `database/migrations/0363_p03_m04_transaction_reversal.sql:59-63` reads the
  original from `transaction` (no RLS). `:73-76` runs `SELECT current_balance … FROM account
  … FOR UPDATE` with **no `IF NOT FOUND`**. `:99-108` inserts the REVERSAL, `:125-128`
  updates the account. The procedure is SECURITY INVOKER.
- **What happens:**
  1. A BRANCH_MANAGER of branch A reverses a branch-B transaction
     (`POST /api/transactions/{id}/reverse`).
  2. Account RLS hides the account, so `v_current_balance` is NULL and `p_balance_after` is
     NULL.
  3. `NULL < 0` does not raise.
  4. The REVERSAL row (`balance_after` NULL), the `transaction_reversal` link and the audit
     row are inserted.
  5. `UPDATE account` affects 0 rows.
- **Impact:** exactly the forbidden state in AGENTS.md §5 ("ledger written but balance
  unchanged"). The original can never be reversed properly afterwards, and reconciliation
  D-1 breaks. Reversals are also allowed on CLOSED/FROZEN accounts.
- **Tests:** WF-TXN-15, API-TXN-23, DB-TXN-11.
- **Likely owner:** Pramudith (implemented by Selith). Route-level manager authorization by
  Nadija.

---

## 4. High

### F-03 — Any transaction can be read by any staff member or customer; `transaction` has no RLS
- **Severity:** High · **Confidence:** Confirmed (code).
- **Where:**
  - `services/transaction-service.ts:166-185`: `SELECT … FROM transaction t … WHERE
    t.transaction_id = $1`, with no account join or scope predicate.
  - No `ENABLE ROW LEVEL SECURITY` on `transaction` anywhere; RLS exists only on
    `customer`, `account` (`0261`), `customer_agent`, `customer_document` (`0223`) and
    `fixed_deposit` (`0420`).
- **Impact:** an AGENT or CUSTOMER in any branch can read any transaction (account id,
  amount, narration, balance) by id. AGENTS.md §10 and NFR-SEC-07 require RLS on
  `transaction`.
- **Tests:** WF-SEC-04, API-TXN-18, DB-SEC-05.
- **Likely owner:** Pramudith (route implemented by Selith); RLS policy is Nadija's slice
  (P06-M01-T03).

### F-04 — Deposit idempotency key is global and does not check the request body
- **Severity:** High · **Confidence:** Confirmed (code).
- **Where:**
  - `database/routines/sp_post_deposit.sql:52-62` returns the stored row for **any**
    existing `idempotency_key`, regardless of account, amount, user or type.
  - `services/transaction-service.ts:29-30,43` reports `replayed:true` and echoes the
    **new** amount next to the old reference and balance.
  - `lib/api/idempotency.ts:7-16` does no format or length check (more than 80 characters →
    500).
- **Impact:**
  - A mistaken reuse silently "succeeds" without posting.
  - Reusing someone else's key (even a withdrawal's) leaks that transaction's id and
    balance.
  - Withdrawals (`0363` repair) and account opening (`account-service.ts:129-141`) do
    compare the payload.
- **Tests:** WF-TXN-03, API-TXN-03, DB-TXN-04.
- **Likely owner:** Pramudith (`sp_post_deposit`); route by Selith on his behalf.

### F-05 — Withdrawal signer handling is wrong (staff default, customers, ALL_HOLDERS)
- **Severity:** High · **Confidence:** Very likely (blocked behind F-01).
- **Where:** `services/transaction-service.ts:65-70, 83`.
  - Staff without `onBehalfOfCustomerId` pass their **user id** as the signer →
    `MANDATE_NOT_SATISFIED`.
  - CUSTOMER is forced to its **user id**, but the SP needs a **customer id** →
    `WITHDRAWAL_NOT_AUTHORIZED`. Sending their real customer id → 403.
  - Only one signer can be sent, so an ALL_HOLDERS joint account can never be withdrawn
    from.
- **Tests:** API-TXN-12, API-TXN-13, WF-TXN-09.
- **Likely owner:** Pramudith (implemented by Selith).

### F-06 — Rejected withdrawals leave no audit row
- **Severity:** High · **Confidence:** Confirmed (code).
- **Where:**
  - `services/transaction-service.ts:79` calls `sp_post_withdrawal` (throws and rolls back
    everything) instead of `sp_try_post_withdrawal` (`0363` repair `:204`), which writes
    `WITHDRAWAL_REJECTED`.
  - `services/transaction-errors.ts:21-32` also lacks codes such as
    `WITHDRAWAL_NOT_AUTHORIZED` and `IDEMPOTENCY_KEY_REUSED` (they become a generic 409).
- **Impact:** FR-WD-05 / BR-L1 ("rejected withdrawal creates no ledger row but is still
  recorded") is not met through the API.
- **Tests:** WF-TXN-06, API-TXN-09, DB-TXN-07.
- **Likely owner:** Pramudith (implemented by Selith).

### F-07 — No way to verify customer documents, so app-registered customers can never get an account
- **Severity:** High · **Confidence:** Confirmed (code + `.agent/open-questions.md`).
- **Where:**
  - Registration stores documents unverified (`services/customer-service.ts`).
  - RLS `customer_document_insert_scope` forbids verified inserts (`0223`).
  - `mims_app` has no UPDATE on `customer_document`.
  - No route or page calls `services/customer-document-service.ts`.
  - `sp_open_savings_account` requires a verified document (`DOCUMENTS_NOT_VERIFIED`,
    `0541`).
- **Impact:** the "register customer → open account" demo flow only works with **seeded**
  customers.
- **Tests:** WF-CUS-09, API-ACC-11.
- **Likely owner:** Vibodha (document verification service exists, not exposed); Nadija
  (grants).

### F-08 — Mockup screens look like features, and pages have no role gate
- **Severity:** High · **Confidence:** Confirmed (code).
- **Where:**
  - `components/mims/workflow-screen.tsx` (hard-coded data) is used by 11 routes (see
    03 §1).
  - `components/mims/workspace-layout.tsx:8-12` checks only for a session; there is no
    `middleware.ts`.
  - `/admin/audit` (`app/admin/audit/page.tsx`) is a client page with no role check.
- **Impact:**
  - Testers and examiners see invented balances on deposit/withdraw/FD/interest/RPT-03/04
    screens. "Confirm when service is connected" does nothing.
  - Every mockup and `/admin/audit` opens for **any** signed-in role, including CUSTOMER.
  - The real account page's **Open a fixed deposit** leads to a mockup.
  - The tracker marks the related tasks DONE (P03-M04-T05, P04-M05-T05 implied, P05-M05-T03).
- **Tests:** UI-MOCK-01…20, WF-SEC-09.
- **Likely owner:**
  - Nadija (shell/layout, mockup component).
  - Pramudith (transaction pages).
  - Selith (FD/interest/RPT-03/04 pages).

### F-09 — RPT-03 and RPT-04 APIs: wrong auth errors, no validation or paging, JS money, broken CSV totals and filter
- **Severity:** High · **Confidence:** Confirmed (code).
- **Where:**
  - `app/api/reports/active-fds/route.ts:35-41` and `interest-distribution/route.ts:33-39`
    run `error.message.includes('role')` on a thrown `NextResponse` → TypeError → **500
    instead of 401/403**. Any internal error containing "role" is echoed with 403.
  - `services/report-service.ts:49-91`:
    - no input validation;
    - `page`/`pageSize` ignored;
    - totals with JavaScript `Number` (AGENTS.md §7);
    - `grandTotal` keys don't match CSV columns, so the CSV total rows are blank.
  - `:122-125`: RPT-04 compares `planId` with `savings_plan_name`.
  - RPT-04 view uses `ROLLUP`, so subtotal rows are mixed with detail rows.
  - A manager's out-of-scope `branchId` is silently ignored (no 403).
  - No API tests exist.
- **Impact:** AC-09 / REP-COM-04 not met for two of five reports.
- **Tests:** WF-RPT-08, 09, API-RPT-06…10.
- **Likely owner:** Selith.

### F-10 — Deposits (and reversals, interest, FD debits) are not attributed to an agent or branch
- **Severity:** High · **Confidence:** Confirmed (code).
- **Where:**
  - `database/routines/sp_post_deposit.sql:93-101` (same as `0361`) omits
    `agent_id`/`branch_id`.
  - Same omission in `sp_reverse_transaction` (`0363` reversal `:99-108`),
    `sp_post_interest_credit` (`0620`) and `sp_open_fixed_deposit`.
  - Only `sp_post_withdrawal` sets them. Account-opening deposits also omit them (`0541`).
- **Impact:** RPT-01 (agent-wise totals) and agent daily activity exclude every API deposit;
  they show up only as "excluded unattributed transactions".
- **Tests:** WF-RPT-02, WF-ORG-09, DB-TXN-03.
- **Likely owner:** Pramudith.

### F-12 — Reconciliation page cannot load under the app role, and redirects to routes that don't exist
- **Severity:** High · **Confidence:** Very likely (grant), Confirmed (redirects).
- **Where:**
  - `database/migrations/0561_p05_m04_reconciliation_views.sql` has **no `GRANT … TO
    mims_app`**; no other file grants on `vw_reconciliation_*`. There are no default
    privileges. `services/reconciliation-service.ts:30-46` queries the views with the app
    pool. The DB test uses the owner connection, so it cannot catch this.
  - `app/reconciliation/page.tsx:10,14` redirects to `/login` and `/unauthorized` (both
    404).
  - `vw_reconciliation_running_balance` (`0561:59-62`) orders by `transaction_date`, not
    `ledger_seq`, so tied timestamps give false D-2 discrepancies.
- **Impact:** `/reconciliation` likely shows the default error page ("permission denied for
  view"). Wrong roles get a 404. The D-1/D-2 control cannot be demonstrated from the app.
- **Tests:** WF-REC-01…03, DB-REC-01…03.
- **Likely owner:** Pramudith (implemented by Nadija).

### F-25 — FD opening and the interest cycle cannot be reached from the application
- **Severity:** High · **Confidence:** Confirmed (code).
- **Where:**
  - No `app/api/fixed-deposits` route.
  - `app/api/interest-runs/route.ts:20` → `services/interest-request-service.ts:12-27` only
    writes an `INTEREST_RUN_INITIATED` audit row (`dryRun` ignored).
  - `mims_app` has no INSERT on `fixed_deposit` and no privileges on
    `interest_run`/`interest_payout`, so `sp_open_fixed_deposit` and `sp_run_interest_cycle`
    (both SECURITY INVOKER) would fail under the app role even if wired.
  - Today they run only in the seed (`database/seed/14_*.sql`, `15_interest_runs.sql`) and
    in owner-connection tests.
- **Impact:** AC-07 ("open an FD, run a 30-day cycle, see a separate credit") can only be
  shown in `psql` as `mims_owner`.
- **Tests:** WF-FD-01…05, WF-INT-01…06, DB-FD-…, DB-INT-….
- **Likely owner:** Selith (FD/interest); Nadija (interest-runs route, written by Vibodha
  during repairs).

### F-26 — Some test files destroy data if run directly against `mims_dev`
- **Severity:** High (for the test session) · **Confidence:** Confirmed (code).
- **Where:**
  - `tests/db/interest-idempotency.test.mjs:5-8, 28, 32-34, 48-50` and
    `tests/db/sp-run-interest-cycle.test.mjs:5-8, 22-25, 35, 47-50` fall back to `.env`
    and run `DELETE FROM interest_payout / interest_run / fixed_deposit` (all rows) and
    `UPDATE account SET current_balance = 500000`, with **no disposable-DB guard**.
  - `tests/db/sp-post-interest-credit.test.mjs:108-115` runs `ALTER TABLE transaction
    DISABLE TRIGGER trg_financial_transaction_immutable`.
  - About 25 other DB test files have no guard and commit ledger rows.
- **Impact:** a teammate who runs one file with `npx tsx --test …` destroys the seeded FDs,
  interest and balances. `npm test` is safe because it creates its own cluster.
- **Likely owner:** Selith (the three files); Pramudith (ledger tests).

### F-36 — Task tracker and acceptance docs overstate completion
- **Severity:** High (for the demo) · **Confidence:** Confirmed.
- **Where:**
  - `docs/09_task-tracker.md` marks these DONE although the UI is a mockup or the route is
    audit-only:
    - P03-M04-T05 ("deposit, withdrawal, receipt, statement, reversal pages", line 278)
    - P04-M04-T02 ("visible in the statement", line 296)
    - P04-M05-T04 ("one transaction per FD", line 300)
    - P05-M05-T03 ("RPT-03 and RPT-04 … pages", line 335)
  - P04-M05-T01/T03/T05 and P05-M04-T01…T03 have **empty** Status cells although code
    exists.
  - `docs/12_testing-and-acceptance.md:14-29` names about 12 test files that don't exist
    (`dependency-guard`, `schema-inventory`, `e2e/onboarding`, `api/transactions`,
    `api/idempotency`, `e2e/fd-interest`, `db/fd-constraints`, `api/reports`,
    `db/ledger-immutability`, `db/reversal`, `db/rls`, `db/withdrawal-rules`) and claims CI
    gates (there is no `.github/`).
- **Impact:** the team may present coverage that does not exist.
- **Likely owner:** each task owner; acceptance matrix Selith (docs/12 owner per
  workload) / Nadija.

---

## 5. Medium

| ID | Finding | Where | Tests | Likely owner |
|---|---|---|---|---|
| F-11 | **Audit gaps.** Admin/master-data writes are recorded as `actor_type='SYSTEM'`, `user_id NULL`, because no RLS context is set before the write. Savings-plan and FD-product changes write **no** audit row (stale TODO says audit_log "not yet built"). No audit trigger on `savings_plan`, `fd_plan`, `fixed_deposit`, `joint_mandate`, `interest_run` | `services/parameter-service.ts:34-64`, `branch-service.ts:68-122`, `agent-service.ts:277-426`, `savings-plan-service.ts:145-149`, `fd-product-service.ts:45-106`; `0200:93-95` | WF-ADM-03, WF-PLAN-02, WF-FDP-02, API-ADM-04 | Nadija (framework), Nisith (plans), Selith (FD products), Vibodha (branch/agent services) |
| F-13 | **`/admin/audit` page:** `datetime-local` value (e.g. `2026-10-09T10:00`) fails the API schema (`z.string().datetime({offset:true})`) → 400. The page **silently keeps old rows**; no loading/error/pagination; labels not linked; browser-local time, not Colombo; `any` types | `app/admin/audit/page.tsx:20-24, 37-58, 54, 58, 79`; `services/audit-query-service.ts:5` | WF-ADM-08, API-AUD-03 | Nadija |
| F-14 | **RPT-05 CSV exports only the current page** (≤100 rows), while the grand total covers everything; the access audit is written after the read transaction | `app/api/reports/customer-activity/route.ts:44-49`; `services/customer-activity-report-service.ts:154-161` | WF-RPT-07, API-RPT-12 | Pramudith (implemented by Nadija) |
| F-15 | **Statement API:** `parseInt` page/pageSize with no bounds (NaN/negative/bad uuid → 500); not-found returns 400 not 404; ordered by `transaction_date` only (no `ledger_seq` tie-break); AGENT not limited to assigned customers (unlike account detail) | `app/api/accounts/[id]/transactions/route.ts:12-13`; `services/transaction-service.ts:135-160` | API-TXN-15, 16 | Pramudith (implemented by Selith) |
| F-16 | **Reversal response and rules:** service maps a non-existent `p_reversal_id`, and the reversal reference is never returned. ADMIN is allowed although docs say "BRANCH_MANAGER only". SP errors such as `CANNOT_REVERSE_A_REVERSAL` / `REVERSAL_WOULD_OVERDRAFT` are not mapped (generic 409); `reason` has no max length (>255 → 500); the `REVERSAL_REASON_REQUIRED` parameter is never read | `services/transaction-service.ts:104-130`; `app/api/transactions/[id]/reverse/route.ts:9`; `transaction-errors.ts:21-32` | API-TXN-20…22 | Pramudith (implemented by Selith); role rule Nadija |
| F-17 | **Login hardening:** throttling is per username only, so anyone can lock any account for 15 minutes; a correct password is refused while throttled. An unknown username skips argon2 (timing oracle). `ACCOUNT_INACTIVE` is only returned after a correct password. `x-forwarded-for` is trusted for the logged IP. The seeded `system` (SYSTEM role) account is ACTIVE and can sign in with the shared seed password | `services/auth-service.ts:31-49, 71-98`; `app/api/auth/login/route.ts:26`; `database/seed/02_users.sql:9` | WF-AUTH-03, API-AUTH-03 | Nadija; Selith (seed) |
| F-20 | **Error envelope inconsistent; raw DB text can leak.** Validation codes: `VALIDATION_FAILED`, `VALIDATION`, `BAD_REQUEST`, `INVALID_INPUT`, `INVALID_JSON`. Forbidden codes: `FORBIDDEN` vs `NOT_AUTHORIZED`. 401 codes: `UNAUTHORIZED` vs `NOT_AUTHENTICATED`. Success shapes vary (`{data,meta}`, `{data,page,pageSize}`). Raw P0001 `RAISE` text is returned as `BUSINESS_RULE_VIOLATION` unless it contains "SELECT"/"FROM", and NOT NULL errors expose column names | `lib/db/errors.ts:96-97, 192-200`; `app/api/admin/parameters/[key]/route.ts:22`; `app/api/audit/route.ts:14`; `app/api/fd-products/[id]/route.ts:24` | API-SEC-03 | Nadija (framework), each route owner |
| F-23 | **FD product PATCH/GET:** non-uuid id or bad JSON → 500; 404 message echoes the raw id; rate change detected by string compare (`"0.13"` vs `"0.1300"` creates a new version); old row renamed `"<name> (expired <ms>)"`, which then appears in history and reports; rate change silently re-activates; GET returns expired rows (docs say current only); page visible to every role incl. CUSTOMER | `app/api/fd-products/[id]/route.ts:16-62`; `services/fd-product-service.ts:45-106`; `app/fd-products/page.tsx` | WF-FDP-03, 04, API-FDP-04 | Selith |
| F-24 | **`docs/05_api-and-pages.md` vs code.** Documented but missing: `POST/GET /api/fixed-deposits`, `GET /api/interest-runs`, `GET /api/reports/reconciliation`. Interest-runs doc says it runs the cycle (201); code is audit-only (200, `dryRun` required). The withdrawal note says "no live route"; one exists. Reversal roles. `GET /api/fd-products` semantics. RPT-04 roles. Logout contract | `docs/05_api-and-pages.md` (lines ~280, 314, 323-334, 422, 456) | 05 §1 | Each endpoint owner |
| F-27 | **Agent scope inconsistent for money movement:** an AGENT can deposit into, and read the statement of, any account in their branch (account RLS is branch-wide), but the accounts list/detail and withdrawals restrict them to assigned customers | `services/account-service.ts:51-53`; `sp_post_deposit` (no assignment check); `0363` repair `:88-90` | WF-TXN-04, API-TXN-05 | Pramudith; Nadija (RLS) |
| F-28 | **Withdrawal error mapping** misses `WITHDRAWAL_NOT_AUTHORIZED` (should be 403), `IDEMPOTENCY_KEY_REUSED` (should be 422) and `INVALID_*` codes; all become `409 BUSINESS_RULE_VIOLATION` | `services/transaction-errors.ts:21-32, 60` | API-TXN-14 | Pramudith (implemented by Selith) |
| F-29 | **Interest cycle:** all FDs run inside one function call (savepoints), not one transaction per FD as AGENTS.md §11 promises. No FD is ever set to `MATURED`; interest continues after maturity; principal is never returned. `INTEREST_CYCLE_DAYS` (editable, tested) is ignored (30 is hard-coded). Failures are only `RAISE WARNING`; status `FAILED` is never set | `database/routines/sp_run_interest_cycle.sql:22-76`; `fn_calculate_fd_interest.sql` | WF-INT-01, DB-INT-01…05 | Selith (cycle config Nadija) |
| F-30 | **`sp_open_fixed_deposit` rules are weak:** posts the principal as type **WITHDRAWAL**, so it counts toward the daily withdrawal limit and RPT-01/02/05 withdrawals. Missing: business-hours check, `MIN_FD_PRINCIPAL` check, `fd_plan.status`/effective-date check, actor check, agent attribution, the published I-6 `fn_fd_funding_verdict`. Error text leaks balances ("have X, need Y"). It is a FUNCTION, not a PROCEDURE | `database/routines/sp_open_fixed_deposit.sql:18-87` | WF-FD-01…04, DB-FD-03…05 | Selith |
| F-31 | **Routines and views outside the migration ledger:** `db-rebuild.mjs` re-applies `database/routines/*.sql` and `views/*.sql` after migrations. `fn_check_plan_minimum`, `fn_check_withdrawal_mandate`, `fn_check_plan_eligibility`, `fn_calculate_fd_interest`, `sp_open_fixed_deposit`, `sp_run_interest_cycle`, `vw_rpt03/04` exist **only** there. `npm run db:migrate` alone gives a broken schema, and edits are not checksum-protected. `sp_post_deposit.sql` duplicates migration 0361 | `scripts/db-rebuild.mjs:36-47` | WF-SETUP-01, DB-SETUP-02 | Pramudith (runner); routine owners Nisith/Pramudith/Selith |
| F-32 | **RPT-03/RPT-04 views bypass RLS:** plain views owned by `mims_owner`, granted to `mims_app`, queried with no RLS context. Scope depends on one service `WHERE`. RPT-01/02/05 use `security_invoker` views + RLS context | `database/views/vw_rpt03_active_fds.sql:1`, `vw_rpt04_interest_distribution.sql:1`; `services/report-service.ts:56, 146` | API-RPT-08, DB-RPT-03 | Selith |
| F-33 | **Backup script hard-codes a DB password** (`mims_app:Mims@123`) and connects as a passwordless `postgres`; it only works on one machine. docs/12 shows its output as AC-13 evidence while P06-M05-T02 is TODO | `scripts/backup-restore-test.sh:8-9` | DB-OPS-01 | Selith |
| F-34 | **Placeholder and weak API tests inflate coverage:** `tests/api/deposits.test.mjs`, `withdrawals.test.mjs`, `reversals.test.mjs` contain only `assert.ok(true)`. `reversal.test.mjs:77-83` accepts "404 or 503" and "403 or 404"; `:91` silently returns when no cross-branch data exists | tests/api files above | 00 "Existing test suite" | Pramudith (placeholders written by Selith; `reversal.test.mjs` by Vibodha for Nadija's task) |
| F-35 | **A test disables the ledger immutability trigger** and deletes ledger rows in cleanup; run with an owner connection on a real DB it removes BR-16 protection (and leaves it off if the DELETE fails) | `tests/db/sp-post-interest-credit.test.mjs:108-115` | — | Selith |
| F-37 | **Report and admin pages unreachable from the UI:** nav and dashboard never link to `/reports/account-summary`, `/reports/customer-activity`, `/reports/active-fds`, `/reports/interest-distribution`, `/plans`, `/interest-runs`. `/reconciliation` card shown to CENTRAL_OPS/AUDITOR but the page also admits ADMIN. CUSTOMER gets no navigation at all | `components/app-shell/top-bar.tsx:12-23`; `app/dashboard/page.tsx:5-16` | WF-NAV-01, WF-DASH-01 | Nadija |
| F-38 | **Session handling differs between screens:** accounts and customers show 401 inline (no redirect); `customer-client.ts` has an unguarded `response.json()` (raw `SyntaxError`/`Failed to fetch` text); RPT-01/02 replace every error with one generic message; `parameter-admin` always says "Failed to load parameters"; `requirePageRole`/`workspace-layout` redirect to `/sign-in` without `?next=`; `assertBranchProfile` throws a `NextResponse` inside a server page (unhandled error page) | `app/accounts/account-client.ts:11-27`; `app/customers/customer-client.ts:1-6`; `lib/auth/page-access.ts:10-11`; `components/mims/workspace-layout.tsx:11` | WF-AUTH-07, WF-SEC-08 | Nadija (framework), Nisith (accounts), Vibodha (customers) |
| F-58 | **App role can bypass the posting routines:** `mims_app` can `INSERT INTO transaction` directly and `UPDATE account.current_balance` within RLS scope. `sp_post_interest_credit` is not revoked from PUBLIC, so the app role can credit interest to any account from SQL. Not reachable from the API today, but weakens "least privilege" (AGENTS.md §10) | `0260:42`; `database/roles/01_app_grants.sql`; `0620` (no REVOKE) | DB-SEC-03, 04 | Pramudith; Nadija (grants) |

---

## 6. Low

| ID | Finding | Where | Likely owner |
|---|---|---|---|
| F-18 | Worker token compared with `!==` (not constant-time); `replace('Bearer ','')` also accepts a raw token; error code differs from the session path | `lib/auth/worker-auth.ts:11-19` | Nadija (written by Vibodha) |
| F-19 | CSRF token issued only at login, not bound to the session, never rotated; logout does not clear `mims_csrf`; the CSRF cookie has no `expires` while the session cookie does, so after a browser restart mutations fail with "CSRF token missing." | `lib/auth/csrf.ts:7-18`; `app/api/auth/logout/route.ts:24-26` | Nadija |
| F-21 | `PUT /api/admin/parameters/MIN_FD_PRINCIPAL` (and any key without a known prefix) accepts any text | `services/parameter-service.ts:44-53` | Nadija |
| F-22 | No API lists transaction channels (needed for `channelId`); `database/seed/_uuids.sql:39-41` lists FD plan UUIDs that don't exist (plans have random ids) | `app/api/**`; `database/seed/_uuids.sql` | Pramudith, Selith |
| F-39 | `any` types in committed code (AGENTS.md §7) | `app/admin/audit/page.tsx:5,77`; `app/api/reports/active-fds/route.ts:35`; `interest-distribution/route.ts:33`; `services/report-service.ts:9,105`; `services/fd-product-service.ts:17` | Nadija, Selith |
| F-40 | `SELECT *` in application code (AGENTS.md §8) | `services/report-service.ts:50,140`; `savings-plan-service.ts:86`; `fd-product-service.ts:51,80,100` | Selith, Nisith |
| F-41 | Dead code / unused objects: financial audit helpers in `services/audit-service.ts`, `business-rules-service.ts`, `interest-config-service.ts` are used only by tests; 0300 functions `fn_check_business_hours`, `fn_check_withdrawal_*_limit`, `fn_get_parameter` not called by any routine (and fail-open); `REVERSAL_REASON_REQUIRED` never read; `fn_fd_funding_verdict` unused; env vars `SESSION_SECRET`, `CSRF_SECRET`, `SESSION_*`, `BUSINESS_HOURS_*`, `BANK_TIMEZONE`, `PASSWORD_HASH_ALGORITHM` not read by the app | as listed; `.env.example` | Nadija, Selith, Pramudith |
| F-42 | Duplicated helpers: CSRF cookie reader ×7, `allowListed` ×2 with different signatures, `BranchScope` ×2, two business-hour SQL functions; money/date formatters duplicated | `top-bar.tsx:25`, `customer-client.ts:8`, `account-client.ts:30`, `FdProductClient.tsx:20`, `parameter-admin.tsx:39`, `organization-table.tsx:79`; `lib/db/query.ts:58`, `lib/report/report-handler.ts:46` | Nadija |
| F-43 | Audit action names inconsistent: routines write `DEPOSIT`, `WITHDRAWAL`, `WITHDRAWAL_REJECTED`, `REVERSED`, `FD_OPENED`; TS union uses `REJECTED_WITHDRAWAL`, `REVERSAL`, `TRANSACTION_REVERSED` | `services/audit-service.ts:19`; `0363` files | Nadija, Pramudith |
| F-44 | Dead links and stubs: mockup links to `/accounts/demo`, `/customers/demo`, `/transactions/demo`; 7 `/sign-in/*` redirect stubs; 8 `/dashboard/*` placeholders with stale "Phase 3/5" text | `components/mims/workflow-screen.tsx:68-103`; `app/sign-in/*`; `app/dashboard/*` | Nadija |
| F-45 | Duplicate migration numbers (`0300` ×2, `0363` ×2) and files in another member's block (`0261` by M1 in M4's block; `0300_*config`/`0401` in M1's block via Vibodha's upload; `0363_*repair` by Vibodha in M4's block). Order is deterministic (filename sort) and both files are recorded, so it works, but it breaks AGENTS.md §8/§12 | `database/migrations/` | Nadija, Vibodha, Pramudith |
| F-46 | ESLint config only enables Next core-web-vitals rules (no TypeScript rules); `ignores` covers `.next/**` but not `.next-dev/**` | `eslint.config.mjs:5-12` | Nadija |
| F-47 | No Content-Security-Policy; HSTS lacks `includeSubDomains` | `next.config.ts:9-24` | Nadija |
| F-48 | Legacy `scripts/db-rebuild.sh` force-drops `mims_dev` and seeds in glob order; `db-create.sh` interpolates passwords into SQL and defaults `PSQL_ADMIN=postgres` (on Homebrew macOS the superuser is your login name) | `scripts/db-rebuild.sh:9-12, 35`; `scripts/db-create.sh:6, 13-16` | Pramudith (runner); files by Nadija & Selith (scaffold) |
| F-49 | Stale docs: `README.md:29-30` says "Phase 0 complete, no features"; `tests/README.md:9` "Empty until Phase 1"; `docs/13_system-operation-guide.md` points to `tests/db/concurrency.test.mjs` (real file: `concurrent-withdrawals.test.mjs`) and describes UI flows that are mockups; `docs/16` lists index `ix_transaction_type_date`, which no migration creates; `docs/10_local-setup.md` §5 describes the old seed size; `.env.example` says business hours end 16:30 but `system_parameter` says 17:00 | as listed | Nadija (integration), each doc owner |
| F-50 | Stray files tracked in the repo root: `analyze.mjs` (imports `pg` outside `lib/db`), `analyze.ts`, `before_indexes.txt`/`after_indexes.txt` (RPT-01 section is just `ERROR: REPORT_ACCESS_DENIED`), `dev_files.txt`, member `temp.txt` files | repo root, `2_Vibodha/`, `3_Nisith/`, `4_Pramudith/` | Selith (analyze/indexes), Nadija (dev_files, temp.txt) |
| F-51 | `audit-trigger` test commits a change to `WITHDRAWAL_SINGLE_LIMIT` and restores a hard-coded value, not the previous one; no disposable guard | `tests/db/audit-trigger.test.mjs:25-29` | Nadija |
| F-52 | Possible flake on a clean clone: `rpt01-runtime` writes `test-results/…json` without `mkdir`; test file order comes from unsorted `readdirSync` | `tests/db/rpt01-runtime.test.mjs:135`; `scripts/verify-phase-01.mjs:84-85` | Vibodha |
| F-53 | Interest credit does not check account status (a FROZEN/CLOSED account still receives credits) or that the FD belongs to the account; `fn_next_transaction_reference` uses the session time zone, not Colombo | `0620:51-58`; `0360:14` | Pramudith (0460/0620 implemented by Selith/Vibodha) |
| F-54 | Mockup RPT-03/RPT-04 pages show a hard-coded "Grand total LKR 316,700.00" that does not match their rows; mockup FD products ("12 month Growth") don't match real products | `components/mims/workflow-screen.tsx:57-61, 96-97` | Selith (pages), Nadija (component) |
| F-55 | No `error.tsx`, `loading.tsx` or `not-found.tsx` anywhere; server-page failures show the Next default error page | `app/` | Nadija |
| F-56 | Accessibility gaps: audit filter labels not linked; mockup search input has no label; repeated "Edit"/"Edit rate"/"Deactivate" buttons lack row context; organisation and FD-product dialogs don't trap or return focus; reconciliation status relies on colour only; sign-in error not `role=alert` | `app/admin/audit/page.tsx:37-58`; `workflow-screen.tsx:101`; `parameter-admin.tsx:117-121`; `FdProductClient.tsx:88,97`; `organization-table.tsx:379`; `app/reconciliation/page.tsx` | Nadija, Selith, Vibodha |
| F-57 | Minor schema gaps: no CHECK `expires_at > created_at` on `user_session`; no `open_time < close_time` on `business_calendar`; `interest_payout.interest_amount` has no `> 0` check; `interest_run` totals nullable; redundant unique index `ux_transaction_reversal_original`; `fd_plan.effective_from` nullable; `system_parameter.data_type` free text | `0100:28`, `0104:28`, `0482:17-29`, `0363` reversal `:13,27`, `0180` | Nadija, Selith, Pramudith |

---

## 7. Checked and found sound

- **All application SQL is parameterized.** Dynamic `ORDER BY` columns come from zod enums
  or `allowListed()`; interpolated fragments are constants
  (`account-service.ts:220`, `customer-service.ts:155`,
  `account-summary-report-service.ts:125`, `rpt01-report-service.ts:90`,
  `customer-activity-report-service.ts:134`, `report-service.ts:14-53`). No user input is
  concatenated into SQL. Full table in 06 §8.
- **No ORM or BaaS.** `pg` is imported only in `lib/db` (plus scripts, tests and the stray
  `analyze.mjs`). No `NEXT_PUBLIC_*` variables.
- **CSRF everywhere it should be.** Every state-changing route calls `verifyCsrf`. Login is
  protected by an Origin check and a JSON content-type requirement.
- **Sessions and passwords.** argon2id (m=64 MiB, t=3, p=4), server-side sessions stored
  as SHA-256 token hashes, idle + absolute expiry, revocation, HttpOnly + SameSite=Lax
  cookie (Secure in production).
- **Errors don't leak SQL.** `withTransaction` maps database errors; the query logger
  redacts parameters. Two caveats are in F-20.
- **Consistent patterns.** Vibodha's customer/organisation/RPT-01 code and Nisith's
  accounts/RPT-02 code consistently use RLS context, zod validation, uniform 404 for
  out-of-scope rows, and transaction-scoped auditing.
- **Ledger and locking.** Ledger immutability (`trg_financial_transaction_immutable` + no
  UPDATE/DELETE grant), `FOR UPDATE` before decisions in deposit/withdrawal/opening/closure,
  partial unique indexes for idempotency and one-active-FD, and `UNIQUE (fd_id, cycle_date)`
  for interest are all present.
