# Live Vercel deployment audit — 2026-10-10

Deployment: https://b-trust-microbanking-and-interest-m.vercel.app

The user requested live deployment testing, including frontend buttons. The safe
test pass is complete. This is not an acceptance claim that every consequential
button works: successful financial posting and privileged administration remain
unverified. No application source, migrations, commits, or deployment changed.

## Results

| Check | Result |
|---|---|
| Live HTTP/API assertions | 759/760 pass; only missing CSP header fails |
| Role/endpoint combinations | 329 checked across all seven roles |
| Page-route probes | 51 checked: 40 HTTP 200, 11 redirects; no detected server-render exception |
| Direct Neon checks | 26/26 pass, including 19 seed invariants |
| Five reports | JSON APIs, browser rendering and CSV downloads pass |
| Reconciliation | 10 accounts / 191 ledger entries; no balance or posting discrepancies |
| Browser console | No captured error/warning messages at the inspection point |

The route probes count expected access and legacy redirects as successful routing,
not as rendered feature pages. The auditor redirect from agent daily activity is
expected; the same activity screen was exercised successfully through admin/agent
navigation. Legacy prototype pages remain placeholders or redirects, not approved
banking functionality.

The API matrix checks authentication, authorization, safe errors, invalid bodies,
missing IDs, cross-branch access, CSRF, logout/session revocation, report exports,
literal injection-like search input, invalid date rejection, and interest dry runs.
They do not prove successful writes, idempotent financial replay or concurrency on
this deployment. Matrix success for an allowed write route means an appropriate
validation/not-found/conflict response to a deliberately non-posting probe.

Neon runtime role is neither superuser nor BYPASSRLS. Customer/account/transaction
RLS is enabled; no-actor reads see no rows; the tested agent sees only its branch.
The runtime role lacks UPDATE/DELETE privileges on the posted ledger and audit log.
Seed account balances total LKR 1,582,020.52; interest distributions total
LKR 66,020.52. Login, session lifecycle, report reads and rejected validation probes
can add session/audit activity. No new financial postings were made by this audit.
Final post-browser read-only verification repeats all 19 seed checks successfully:
10 accounts, 191 transactions, balance total LKR 1,582,020.52. API/page test sessions
were logged out; browser sign-out was visibly verified and the temporary tab closed.

## Frontend control coverage

| Screen | Controls actually exercised |
|---|---|
| Sign-in / dashboard / shell | Username/password, show/hide password, sign-in, menu, workspace links, brand return, sign-out |
| Users | Search; Manage/Cancel for all 13 human users; role/status selection; create form, empty required validation and Cancel |
| Roles / health | Human-role catalogue; connected database, pool and 70-migration status |
| Parameters | Edit/Cancel for all 9 rows; invalid withdrawal-limit Save rejected |
| Branches | Status filter, create form/empty validation/Cancel; all 3 deactivation dialogs/Cancel; Escape dismissal |
| Agents | Status/create form/empty validation/Cancel; all 6 ordinary-agent deactivation dialogs/Cancel; activity navigation |
| Agent activity | Date inputs, future-date bound, Show activity, Today, Back |
| Savings plans | All 5 Edit/Cancel dialogs; invalid rate Save rejected |
| FD products | All 3 Edit rate and Deactivate dialogs/Cancel; invalid rate review; valid rate confirmation preview/Cancel |
| Customers | Name/status/sort/direction search, detail link, profile/back navigation; document Add/Remove; empty registration validation |
| Accounts | Name/plan/sort search, detail/holder links; opening plan picker, holder Search/Add/Remove, Make primary, mandate, Review/Edit application |
| Deposit | Account lookup/select, amount/narration, Review, confirmation preview, Back to edit, zero-amount rejection |
| Withdrawal | Account lookup/select, missing-authorization rejection, holder checkbox, Review, preview, Back; customer menu and owned-account restriction |
| Transfer | Source/destination selection, amount, authorization checkbox, Review, preview, Back to edit |
| Receipts / statements | Seed receipt links, receipt-to-statement link, account-details return; manager reason validation, reversal Review/Cancel |
| Fixed deposits | List/Open navigation; product/account/principal selection; duplicate active-FD quote rejected |
| Interest runs | Native cycle-date input, Preview distributions, completed run history |
| Reports 01–05 | Rendering, filters/Apply, CSV download; 01 branch/sort/order/page size; 02 plan/status/sort; 04 Next/Previous and one-cycle period; 05 status/date filters |
| Audit | Search/entity filter; Next/Previous/reset-to-first-page |
| Reconciliation | Read-only control totals and zero discrepancies |
| Mobile | 390×844 statement view and Menu expand/collapse; viewport restored |

Pagination is correctly disabled where the seed has only one page. No additional
records were created solely to activate pagination. Retry-on-network-error buttons
and every possible combination of filters/roles were not individually exercised in
the browser. API role coverage is broader than interactive browser role coverage
(ADMIN, AGENT, BRANCH_MANAGER and CUSTOMER).

Native date controls were retested with accessibility setValue after the browser's
DOM fill operation did not persist date values. This was an automation limitation,
not a confirmed application defect. RPT-02 on 2026-10-09 returns zero activity and
zero balances before the newly loaded seed postings; RPT-04 on 2026-02-01 returns
LKR 22,006.84. The seed ledger timestamps are the seed-load day even though fixture
account/FD opening and interest cycle dates are historical.

Interest preview on 2026-10-10 showed 48 due FD payouts and estimated credit
LKR 118,417.74. This is a preview of overdue synthetic fixture cycles, not a posted
result. Do not use this preview as a harmless replay candidate.

## Findings for owners

1. **P2 — Report navigation is incomplete (M1 / report owners).** Reports in the
   dashboard and shell lead only to RPT-01. RPT-02 through RPT-05 work via direct
   URLs but have no visible report selector or cross-links. Add a report workspace
   with links appropriate to the existing server permissions.
2. **P2 — Staff withdrawal is missing from navigation (M1 / M4).** Agent/manager
   Transactions links open deposit only; Withdraw is restricted to CUSTOMER in
   the shell and dashboard. The staff withdrawal form works via its direct URL.
   Add an accessible deposit/withdraw switch or separate staff withdrawal link.
3. **P2 — Staff account detail has no statement link (M3).** Statements and receipt
   links work, and customer My accounts has Statement links, but the staff detail
   page omits one. Add a link to the existing authorized statement route.
4. **P2 — Savings-plan administration lacks navigation (M1 / M3).** `/plans` is
   implemented with working Edit/Cancel forms but is absent from the dashboard
   and shell. Add an appropriate product-catalogue link.
5. **P3 — CSP hardening absent (M1 / shared deployment config).** Live responses
   lack Content-Security-Policy. HSTS, nosniff, referrer and permissions headers and
   Secure/HttpOnly/SameSite session cookies pass. Introduce a tested Next.js-
   compatible policy; missing CSP is a hardening finding, not evidence of a known
   exploitable failure or a stated project acceptance requirement.
6. **P3 — Unbounded report period label (M5 / report framework).** RPT-03/RPT-04
   initially show blank date fields and applied period `to`. Unbounded queries
   return valid data. Label an omitted range as Any date / All dates.

These are review findings only. Fixing/publishing them was not requested in this
test task. Ownership has not shifted.

## Deferred final actions

- Confirm and post deposit/withdrawal; Confirm transfer/reversal.
- Confirm account opening / holder addition / account closure / FD opening.
- Confirm and process interest cycle; successful financial idempotent replay and
  concurrent posting.
- Valid user creation, access/password changes, reset-link issuance; valid parameter
  or plan/rate changes and final branch/agent/product deactivation.
- Full password-reset/token consumption flow and timeout-duration testing.

Automatic approval review explicitly rejected the initial non-dry-run interest
replay because it could create financial postings and audit state in the live
deployment. The replay was removed, not rerouted. Browser policy also requires
user handoff for consequential financial actions and credential changes. A
supervised isolated test fixture or staging deployment is needed to complete those
checks; no production safeguards/hours were altered. The session ran outside
configured business hours (database control: 08:30–17:00 Asia/Colombo).

P06-M01-T04 remains IN_PROGRESS. This audit does not approve Phase 6 or close the
pending deployment/acceptance checkpoint.

## Evidence

Ignored local evidence, without connection strings/cookies/passwords:

- `scratch/live-audit-api.json` and `scratch/live-audit.mjs`
- `scratch/live-audit-db.json`
- `scratch/live-audit-final-db.json`
- `scratch/live-audit-pages.json` and `scratch/live-pages.mjs`
- `scratch/live-audit-ui.json`
- `scratch/live-reconciliation.png`, `scratch/live-mobile-statement.png`

CSV files were downloaded through the browser to the normal Downloads directory.
Evidence is local and has not been committed or published. Review checklist was
used to distinguish confirmed defects, hardening gaps and untested final actions.
