# P05-M03-T02: RPT-02 account summary report (service, API, CSV, page)

**From:** Member 3 · **To:** Member 1 (report framework, audit), Member 4 (ledger), Member 5 (seed) · **Date:** 2026-10-08
**Task:** P05-M03-T02 · **Status:** built and tested (tests only, no browser pass, by the user's choice). Early start at the user's direction; not a general Phase 5 entry approval. No migration.

## What exists now
- **`services/account-summary-report-service.ts`**
  - `getAccountSummaryReport(filters, user)`: in ONE `REPEATABLE READ` transaction it re-reads the caller (active user, role, and for a manager an active agent/branch profile), sets the RLS context, runs the totals, the page (or every row for CSV) and the page subtotal, and writes the `REPORT_ACCESSED` audit row (`auditReportAccess(..., tx)`), so rows, totals and the audit agree.
  - `getAccountSummaryChoices(user)`: branches (a manager gets only their own) and savings plans for the filter form.
- **`GET /api/reports/account-summary`** (`app/api/reports/account-summary/route.ts`). Roles BRANCH_MANAGER (own branch), CENTRAL_OPS, AUDITOR, ADMIN. Contract in `docs/05_api-and-pages.md` ("RPT-02 live delivery").
- **Validation** `lib/validation/account-summary-report.ts` (strict keys, repeated keys rejected, one date means one Colombo day, absent dates mean today, sort/direction allow-lists) and **types** `types/account-summary-report.ts`.
- **Page** `/reports/account-summary` (`page.tsx` + `account-summary-screen.tsx`) on the shared `ReportShell`: typed columns incl. opening and closing balance, branch/plan/status/sort filters, pagination, notes, CSV button. It replaces the mock `WorkflowScreen`.
- **Shared components:** three optional props were added to M1's report components (defaults keep RPT-01 unchanged): see [p05-m03-report-shell-props-for-m1.md](p05-m03-report-shell-props-for-m1.md).

## Behaviour to know
- **Opening/closing** = `balance_before` of the first posting (lowest `ledger_seq`) at or after the start of the period, else the account's current balance; closing = `balance_after_effective` of the last posting before the end of the period, else the opening balance. Read from the ledger's stored running balance, never re-summed. An account with no posting in the period is listed with the same balance on both sides.
- **Totals are net of reversals** (a reversal sits in its original category, negated, as in RPT-05); counts are original postings and reversals are counted separately; `closing − opening = deposits − withdrawals + interest` (asserted for every range in the tests). `netMovement` is `closing − opening`.
- **CSV exports every filtered account** with the same grand total as the JSON; paging does not apply. It is built in memory (one row per account) and refuses more than 50,000 accounts with a `400` asking to narrow the filters. RPT-05's CSV, by comparison, exports only the current page (not touched here, and noted for M4).
- **Branch scope is in SQL** (`v.branch_id = $1`), plus the caller's RLS. A manager naming another branch gets `403`; a manager's `accountId` from another branch returns an empty report (no existence leak). Refused and invalid requests write no audit row.
- **Dates:** Asia/Colombo calendar days, both ends inclusive, with exact midnight boundaries (`[start of from, start of to + 1 day)`).

## Query plans (the card asks for `EXPLAIN ANALYZE`)
Measured on 40,125 ledger rows over 410 accounts in two branches (the shipped SQL, extracted from the service), rolled-back transaction:

| Request | Plan | Time |
|---|---|---|
| One account | index scans on `account_pkey` and `ux_transaction_account_ledger_seq` (`account_id, ledger_seq`); the legacy running total is skipped by a one-time filter | **0.31 ms** |
| One branch (205 accounts), page of 25 | seq scan of the ledger joined to the branch's accounts, grouped | **65 ms** (totals query 72 ms) |
| Bank-wide, page of 25 | the same over all accounts | **176 ms** |

- A multi-account request must read the scoped accounts' ledger history (opening balances need it), so cost grows linearly with their ledger rows. NFR-PERF-03 (each report < 5 s on the sample dataset) is met by a wide margin; the seed has 125 rows.
- **Not met yet / for later (NFR-PERF-04, 1,000,000 ledger rows, P06-M04-T02):** a page request currently runs the aggregate three times (totals, rows, page subtotal), so bank-wide cost at a million rows would be several seconds per query. A single pass (window functions for the grand total and the page subtotal over one aggregate) or a per-request temporary summary would cut that to one. Not done now; recorded in `.agent/open-questions.md`.
- No new index was added: single-account lookups use `ux_transaction_account_ledger_seq` (added in 0542 for ordering), as the card prefers reuse.

## Evidence
- `tests/api/rpt02-report.test.mjs` 16/16 (the routes run as `mims_app`): 401/403 for no session, agent and customer, and 403 for a manager naming another branch; exact opening/closing/counts/totals with the balance identity; a reversal netted into its original category; accounts with no posting (empty ledger, a period after the last posting, a period before the first); Colombo-midnight boundaries on UTC instants (included and excluded exactly); postings that share a timestamp ordered by `ledger_seq`; legacy NULL `balance_after` rows; branch scope (a manager sees only their branch, a foreign `accountId` returns nothing, bank-wide roles filter by branch); plan and status filters; page subtotal and grand total checked against the rows and a full-size page; allow-listed sort; CSV has every account and the same grand total as the JSON (parsed with a real CSV reader) and no page subtotal; both JSON and CSV accesses audited with report name and filters, refused/invalid requests not audited; 17 invalid inputs (including a SQL-injection sort value) answered `400 VALIDATION_FAILED` with no internals; default period is today in Colombo; no-store headers; envelope shape and no `ledger_seq`/internal keys in rows.
- `tests/e2e/account-summary-report-screen.test.mjs` 7/7 (rendered markup, child-process renderer): exact LKR cells, row header, page subtotal vs grand total, custom caption and empty text, this report's sort label, RPT-01's caption/empty text/sort labels unchanged, filter form for a bank-wide user (all branches, plans, statuses, sorts; dates default to today; no agent filters; no export before a report), a manager's branch fixed and disabled, no internal keys in the markup.
- Full isolated suite: 888 tests, 860 pass, 28 fail, 0 cancelled. The 28 are failures that already occur on dev without this work (none involve RPT-02); `tsc --noEmit`, `eslint .` and `next build` pass (the build lists `/api/reports/account-summary` and `/reports/account-summary`). Committed ledger rows the API suite creates are removed in its teardown (the ledger guard is lifted only for those rows, on the disposable database).

## Not done
- No browser pass of the page (tests only): layout at narrow width and the real CSV download were not looked at.
- The single-pass query optimisation above.
