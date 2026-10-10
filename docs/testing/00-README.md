# MIMS Test Package — Start Here

This folder documents **every page, endpoint and database object** on the `dev` branch,
**who built what**, and a **test plan to walk through the whole application** before the
demo and submission. It was written by reading the code on `dev` (HEAD `b38150e`,
2026-10-09). No source code was changed.

---

## 1. Documents

| # | File | What it is for | Main reader |
|---|---|---|---|
| 00 | `00-README.md` | This index, how to run the session, unmerged work, existing tests, open questions | Everyone |
| 01 | `01-PROJECT-OVERVIEW.md` | What MIMS does, roles, business rules, architecture diagram, folders, local setup, test accounts | Anyone new to a part |
| 02 | `02-MEMBER-CONTRIBUTIONS.md` | Who owns and who built each feature; files, routes, endpoints, DB objects; demo script per member | Each presenter |
| 03 | `03-UI-INVENTORY.md` | Every page: route, roles, forms, API calls, states, navigation; which pages are mockups | Browser testers |
| 04 | `04-WORKFLOW-TEST-PLAN.md` | **The main test plan.** 117 workflow tests + 20 mockup checks, in run order, with coverage summary | Everyone |
| 05 | `05-API-AND-BACKEND-TEST-PLAN.md` | All 37 API handlers with curl examples; 121 API tests | curl/Postman testers |
| 06 | `06-DATABASE-TEST-PLAN.md` | Every constraint, routine, trigger, view, RLS policy and grant, with SQL; 82 DB tests; parameterized-SQL audit | psql/pgAdmin testers |
| 07 | `07-STATIC-REVIEW-FINDINGS.md` | 58 problems found while reading (2 Critical, 12 High) and lint/type-check/build results | Owners deciding fixes |
| 08 | `08-TEST-TRACKER.csv` | All 340 test cases in one sheet (Status column for Pass/Fail) | Import to Google Sheets |
| 09 | `09-TOOLS-AND-SETUP.md` | Tool installation (macOS/Windows), how to use each tool, pre-session checklist | Everyone, before the session |

**Read first:** 09 (install), then 01 §6 (setup), then 04 (what to run).

---

## 2. Read this before the session (the short version)

1. **Some pages are mockups.** Deposit, withdraw, transaction detail, statement, fixed
   deposits, FD opening, interest runs, RPT-03, RPT-04, users and roles show
   **hard-coded sample data**. Their buttons do nothing. The plan tests them only as
   "Mockup — no backend" (UI-MOCK-01…20). The real logic is tested through the API (curl)
   or SQL.
2. **There is no app path for opening an FD or running the interest cycle.** These are
   tested in `psql` as `mims_owner` (WF-FD-…, WF-INT-…).
3. **Expect these failures** (details in 07):

   | Finding | What fails | Tests that will fail or be blocked |
   |---|---|---|
   | F-01 | Withdrawal API → 500 on every call | WF-TXN-05…11 |
   | F-02 | Cross-branch reversal corrupts the ledger | WF-TXN-15; run the rolled-back SQL version DB-TXN-11 instead |
   | F-12 | Reconciliation page likely errors (missing grant) | WF-REC-01 |
   | F-07 | Customers registered in the app cannot open accounts (no document verification) | WF-CUS-09; use seeded customers for account tests |

4. **Business hours** are 08:30–17:00 Asia/Colombo. Outside them, deposits and openings
   with money are refused; run WF-ADM-03 first.
5. **Never run single DB test files directly** (`npx tsx --test tests/db/…`) against
   `mims_dev`. Some delete all FD and interest data (F-26). `npm test` is safe.

---

## 3. How to run the team review session

**Format:** one shared screen (presenter) plus each tester on their own machine. Use the
shared Google Sheet from `08-TEST-TRACKER.csv` (09 §9).

- The **owner presents** their part using the demo script in 02.
- The **tester named in the row** executes the test and records Pass/Fail with a note.
- Testers never test their own work. For Member 4 features built by Selith or Nadija, the
  tester is neither Pramudith nor the implementer.

**Before the day:** everyone completes the checklist at the end of 09. One person (suggest
Selith, the seed steward) runs `npm run db:rebuild -- --reset` on the presenting machine.

| Order | Section (04) | Presenter (owner) | Supporting | Testers | Time |
|---|---|---|---|---|---|
| 1 | 2.1 Setup + seed (WF-SETUP) | Selith | — | Nadija | 10 min |
| 2 | 2.1 Sign-in, session, nav, dashboard (WF-AUTH, NAV, DASH) | Nadija | — | Vibodha | 25 min |
| 3 | 2.2 Administration (WF-ADM) — open business hours here | Nadija; health by Pramudith | — | Vibodha, Selith | 20 min |
| 4 | 2.3 Organisation (WF-ORG-01…08) | Vibodha | — | Nisith | 20 min |
| 5 | 2.4 Plans and FD products (WF-PLAN, WF-FDP) | Nisith, Selith | — | Pramudith, Nadija | 15 min |
| 6 | 2.5 Customers (WF-CUS) | Vibodha | — | Nisith | 25 min |
| 7 | 2.6 Accounts (WF-ACC) | Nisith | — | Pramudith | 30 min |
| — | **Break** | | | | 15 min |
| 8 | 2.7 Transactions via API + SQL (WF-TXN) | Pramudith (owner) | Selith (built withdrawal/reversal/APIs), Vibodha (withdrawal repair) | Vibodha, Nisith | 40 min |
| 9 | 2.8 Fixed deposits and interest in SQL (WF-FD, WF-INT) | Selith | Nadija (interest request route) | Nadija, Vibodha | 25 min |
| 10 | 2.9 Agent activity, reports, reconciliation (WF-ORG-09…11, WF-RPT, WF-REC) | Vibodha (RPT-01), Nisith (RPT-02), Pramudith (RPT-05, reconciliation), Selith (RPT-03/04) | Nadija (built RPT-05 and reconciliation; report framework) | Nisith, Pramudith, Nadija | 30 min |
| 11 | 2.10 Security (WF-SEC) + restore settings (WF-END-01) | Nadija | all | Vibodha, Pramudith | 20 min |
| 12 | 2.11 Mockup pages (UI-MOCK) | Nadija (built them) | slice owners | Vibodha, Pramudith, Selith | 15 min |
| 13 | API sweep (05) and DB sweep (06) for rows not already run | each owner | — | testers in 08 | 60 min, can be split per person after the session |
| 14 | Wrap-up: list Fails, decide fixes from 07, assign owners | everyone | — | — | 15 min |

**Total:** about 4 h 30 min plus the 60-minute API/DB sweep. You can split it into two
sessions after step 7.

**Rules during the session:**

- Keep DevTools open (Console + Network).
- Write the request/response or SQL error in Notes for every Fail.
- Rows marked *Blocked* because of F-01 should run their SQL equivalent (named in the
  Notes).
- Do not commit anything to `mims_dev` that you will not reset. WF-FD-01 and WF-INT-01
  commit on purpose.

---

## 4. Work not yet merged into `dev`

Checked every local and remote branch with `git log dev..<branch>` (remote refs as of the
last fetch; `origin/dev` = local `dev`).

| Branch | Author | Commits not in dev | Content | Status in the test plan |
|---|---|---|---|---|
| `origin/feat/p01-m01-parameters-audit` | Nadija | 4 | RLS/audit migrations `0200`, `0201`, `0261`, `rls-context.ts`, `rls-audit` test — **byte-identical to dev** (merged via `b6f7cd0`); only old docs differ | Nothing pending |
| `origin/revert-31-feat/p01-m04-lib-db-hardening` | Vibodha | 1 | GitHub revert of the `lib/db` hardening | Must **not** be merged |

**No feature is "Pending merge."** All other branches are merged into `dev`.

---

## 5. Existing test suite

### How to run it

```bash
LC_ALL=en_US.UTF-8 npm test        # all suites (macOS needs LC_ALL; Windows/Linux: npm test)
npm run test:db | test:api | test:security
npm run verify:phase1              # rebuild + all tests + typecheck + lint + build
```

**What it needs:**

- Node 20/22.
- PostgreSQL server binaries **`initdb` and `pg_ctl` on PATH** (or `PG_BIN`).
- About 5–15 minutes.
- **No running dev server and no seed data.** The runner (`scripts/verify-phase-01.mjs`)
  creates a **throwaway PostgreSQL cluster** in your temp folder on a random port, builds
  and seeds its own database `mims_test_closeout`, runs the tests and deletes the cluster.
- It **never reads `.env`** and **never touches `mims_dev`**.

**What it does not need:** Playwright or a browser. There are none.

**Warning:**

- About 25 DB test files and 6 API/e2e files fall back to `.env` when run on their own,
  with no disposable-DB guard.
- `tests/db/interest-idempotency.test.mjs` and `sp-run-interest-cycle.test.mjs` then
  **delete all FD and interest rows** in `mims_dev`.
- `sp-post-interest-credit.test.mjs` can **disable the ledger immutability trigger**.
- Run tests only through the npm scripts (07, F-26).

**Last result:** **not run** for this package (waiting for the team's go-ahead). The last
recorded run in `.agent/current-state.md` (Vibodha, 2026-10-09) was **1062 tests in 98
suites, all passing**. `test-results/` holds only two EXPLAIN JSON files, not a run
summary.

### What it covers

| Folder | Files | What | Needs DB? |
|---|---|---|---|
| `tests/db` | 54 | Constraints, routines, triggers, RLS, views, concurrency, seed validation | Yes (disposable) |
| `tests/api` | 27 | Route handlers called in-process (no HTTP server): auth, roles, scope, CSRF, validation, reports | Mostly yes |
| `tests/e2e` | 8 | **Not browser tests.** 6 pure-logic/static-render tests of page models; 2 call route handlers | 2 of 8 |
| `tests/security` | 1 | Deployment env checker and security headers | No |
| `tests/helpers` | 10 | Fixtures, session builder, render helpers | — |

**Test files by original author:**

| Member | Test files |
|---|---|
| Vibodha | 35 |
| Nisith | 23 |
| Selith | 13 (3 are `assert.ok(true)` placeholders) |
| Nadija | 10 |
| Pramudith | 7 |
| Nadija & Selith (scaffold) | 2 |

In `08-TEST-TRACKER.csv`, 225 of 340 test cases are already covered by an existing test,
42 partially and 73 are manual only.

### Top gaps to automate next

1. **API tests for money endpoints.** `deposits`, `withdrawals` and `reversals` API tests
   are placeholders (`assert.ok(true)`). Add real tests for `POST /api/transactions/deposits`,
   `/withdrawals` (would have caught F-01), `/reverse` (cross-branch, F-02),
   `GET /api/transactions/{id}` (F-03) and the statement route.
2. **RPT-03 and RPT-04 API + CSV tests** (none exist; F-09).
3. **Reconciliation as `mims_app`.** The current test uses the owner connection, so the
   missing grant (F-12) is invisible.
4. **Role × route matrix and SQL-injection suite** (P06-M01-T01/T02, both TODO). Postman
   collection from 05 §3.10 is a start.
5. **Browser smoke tests with Playwright** (optional; 09 §5): sign-in, customer
   registration, account opening, RPT-01 CSV, and the 20 mockup checks.
6. **Guard all DB test files** with `requireDisposableDatabase()` so they cannot run
   against `mims_dev` (F-26).

### Static checks run for this package (2026-10-09)

| Check | Result |
|---|---|
| `npx tsc --noEmit` | PASS |
| `npx eslint .` | PASS |
| `npx next build` | PASS (no warnings) |

---

## 6. Open questions for the team

Decisions only the team can make. The finding numbers refer to 07.

### Fix-before-demo decisions

1. **Withdrawal API (F-01, Critical).** Fix before the demo (a one-line cast in
   `services/transaction-service.ts`), or demonstrate withdrawals only in SQL? Owner
   Pramudith; implemented by Selith, repaired by Vibodha.
2. **Cross-branch reversal and transaction read scope (F-02, F-03).** Add the account-found
   / branch check in `sp_reverse_transaction` and RLS on `transaction` before the demo?
3. **Mockup pages (F-08).** Wire deposit/withdraw/statement/FD/interest/RPT-03/04 screens to
   the existing APIs, hide them from navigation, or present them clearly as mockups?
   `docs/13_system-operation-guide.md` and `docs/demonstration-script.md` describe these UI
   flows as if they work.
4. **FD opening and interest cycle in the app (F-25).** Add `POST /api/fixed-deposits` and
   make `POST /api/interest-runs` run the cycle (with grants), or demonstrate them in
   `psql`?
5. **Document verification (F-07).** Add a verify-document endpoint/button (the service
   already exists), or only use seeded customers in the demo?
6. **Reconciliation grant and redirects (F-12).** Grant `SELECT` on the two views to
   `mims_app` and fix `/login` / `/unauthorized` redirects?

### Behaviour the team should confirm

7. Should **ADMIN** be able to reverse transactions? The code allows BRANCH_MANAGER and
   ADMIN; `docs/05` says BRANCH_MANAGER only (F-16).
8. Should **ADMIN** be blocked from the customer and account pages (current behaviour)?
9. Should an **AGENT** deposit into any account in the branch (current deposit behaviour),
   or only into accounts of assigned customers (current accounts/withdrawal behaviour)
   (F-27)?
10. **CUSTOMER role:** it has no navigation at all. Is customer self-service part of the
    demo?
11. **Business hours:** `.env.example` says 16:30, the database says 17:00. Which is
    correct (F-49)?
12. **Interest after maturity:** should FDs become MATURED and stop earning? Should
    `INTEREST_CYCLE_DAYS` drive the cycle instead of the fixed 30 days (F-29)?
13. Should the FD principal debit be its own transaction type rather than WITHDRAWAL, so
    it doesn't count toward withdrawal limits and reports (F-30)?
14. **Playwright:** add it as a devDependency for browser automation (09 §5)? It changes
    `package.json`.

### Housekeeping

15. Delete the stale branches `feat/p01-m01-parameters-audit` and
    `revert-31-feat/p01-m04-lib-db-hardening`?
16. `docs/09_task-tracker.md` marks P03-M04-T05, P04-M04-T02, P04-M05-T04 and P05-M05-T03
    DONE although their UI is a mockup or the cycle runs in one call; and P04-M05-T01/T03/T05
    and P05-M04-T01…T03 have empty Status cells. Update the statuses (F-36)?
17. Remove the stray root files (`analyze.mjs`, `analyze.ts`, `before_indexes.txt`,
    `after_indexes.txt`, `dev_files.txt`, member `temp.txt`) and the hard-coded password in
    `scripts/backup-restore-test.sh` (F-33, F-50)?
18. Who resets `mims_dev` during and after the session?
19. Go-ahead to run the existing test suite (`LC_ALL=en_US.UTF-8 npm test`) and record the
    result in 07 §1. It only uses a throwaway cluster.

### AGENTS.md process steps skipped by this documentation task

These were not done, on purpose, because this task only adds files under `docs/testing/`.
Do them yourself if you want them:

20. `docs/00_documentation-index.md`: add a link to `docs/testing/00-README.md`.
21. `docs/09_task-tracker.md`: record this test package (it closes no task; it supports
    P06-M02-T03 "final documentation pass" and P06-M01-T01/T02).
22. `.agent/current-state.md`: add an entry for the test package and the Critical findings.
23. All five `00_OVERVIEW.md` "Work Order Summary" tables: review (no task status changed).
24. `memory.md`: `/remember save` at the end of the session.
25. `.agent/handoffs/`: a handoff to each owner listing their findings from 07 (optional).
26. Git: create the branch, commit and open the PR yourself (AGENTS.md §12, §17). This
    task did not run any git command that changes the repository.
