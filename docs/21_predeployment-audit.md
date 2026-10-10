# 21 — Predeployment audit and frontend verification

2026-10-10 · P06-M02-T03 · `feat/p06-m02-final-documentation` · ADR-0027.
The user authorized fixes across member boundaries and a local commit, with no push,
PR or merge. This record supersedes the 2026-10-09 implementation-gap snapshots.

## Requirement decisions and financial behavior

- Transfers are staff-only, explicitly confirmed by the user. AGENT/BRANCH_MANAGER
  operate within their current branch; an agent must be assigned to a source holder.
  Source holder attestations satisfy the stored mandate. The database locks both accounts
  in UUID order and atomically posts equal TRANSFER_OUT/TRANSFER_IN entries with one
  transfer group. A deferred constraint rejects an incomplete or unequal pair.
- Transfer debits share the per-account single/daily withdrawal limits and business
  hours, and preserve the savings-plan minimum. Payload-bound keys replay the original
  pair; altered amounts, actors, destinations, signers or narration conflict.
- Manager reversal of either transfer leg compensates both legs atomically. Insufficient
  destination balance, inactive accounts or a failed audit abort both compensations.
  FD funding, interest and maturity system postings cannot be independently reversed.
- Savings uses SQL daily closing ledger balances in Asia/Colombo, carried forward on
  days without activity, actual/365 and cent rounding. The interval is [unpaid cursor,
  cycle date), never before opening. Late runs retain every unpaid day, including periods
  longer than 30 days. Each payout snapshots the current plan rate and paid interval.
  Historical effective-dated savings rates are outside the existing mutable-plan model.
- FD catch-up processes each eligible 30-day due date separately through maturity.
  Principal is returned automatically, as explicitly confirmed by the user, through one
  FD_MATURITY ledger credit, unique receipt, balance update, FD status and audit transaction.
  This is principal return, not an additional interest distribution.
- No future cycle is allowed. FD distributions, savings distributions and maturity returns
  each have their own transaction. Earlier committed work survives a later exception.
  A RUNNING or completed-with-exceptions cycle requires operator review; completed replay
  does not retry exceptions or duplicate money.
- Closure keeps the SRS zero-balance/no-active-FD rule. A database guard also rejects
  positive unpaid savings interest. No unapproved final withdrawal that waives the plan
  minimum or forfeits interest is introduced. The fuller funded-account settlement policy
  remains an open requirement question, recorded in `.agent/open-questions.md`.

## Fixes and coverage

| Area | Corrected behavior | Evidence |
|---|---|---|
| Deposits | Exact finite cents, stored actor/scope, account lock, payload-bound replay, correct posting time and attribution | API races/replay/negative tests; SQL deposit/performance suites |
| Identity documents | Scoped execute-only verification, paired verifier/date, stable replay, audit | Runtime API, branch/CSRF denial tests |
| Financial UI | Real deposit/withdrawal review/posting, receipt/reversal, paginated statement; customer owned-account list; staff transfers | Interactive browser pass plus API/DB suites |
| Account selection | Search and pagination rather than first-100 truncation; empty search omitted | Browser deposit/transfer/FD selection; strict account API |
| Statements/reconciliation | Posting sequence order and repeatable read; exact SQL totals and live actor authorization | API/SQL ledger-order and reconciliation checks |
| Reports | Transfers/maturity categorized consistently; savings payout products appear in RPT-04; signed reversals | Existing report API/view/totals/CSV suites on the extended schema |
| User administration | Real guarded users/roles pages, required profile links, Argon2id, status/role updates and session revocation | Runtime API, profile atomicity, last-admin and CSRF tests |
| Password reset | ADMIN-issued 30-minute hashed single-use token; supersession/expiry; atomic consumption/password/session changes | Parallel consume, expiry, old-token and password verification tests |
| Errors | Known fixed domain messages; unknown raised SQL errors return a generic response | Security/injection matrix and negative API tests |
| Navigation/animation | Role-appropriate workspaces, real legacy transaction/FD redirects, scoped animations only when targets exist | Browser role navigation; typecheck/lint/build |

Reset links use a URL fragment, removed from the address bar after capture, to keep the
bearer capability out of HTTP query logs/referrers. The link is returned only to the
issuing administrator for private delivery to a verified user; there is no email sender.
Database audit values never contain passwords or raw reset tokens.

## Browser evidence

Disposable synthetic preview (`npm run verify:phase1 -- --preview`), not a development
or production database. Verified customer/manager/admin sign-in and sign-out, customer
account ownership/navigation, staff deposit posting, real receipt and ledger statement,
zero withdrawal rejection and confirmation, transfer source holders/review, FD active
product selection and duplicate-FD eligibility error, administrator branch-profile fields,
real user rows, audit search and posted-deposit audit entry. Desktop 1280×800 and mobile
390×844 checks covered navigation and transfer confirmation; viewport was restored.
The preview cluster and browser tab were stopped after verification.

Local screenshot evidence: `test-results/frontend-deposit.png` (ignored synthetic
artifact). This is a targeted operational browser pass, not every possible permutation
of every page. Automated role, API, SQL, concurrency and markup checks provide the wider
coverage. Old unrelated private-banking concept pages are outside the SRS workflow and
are not linked as operational workspaces.

## Verification receipt

Final `npm run verify:phase1 -- --catalog --tap` passed **3,397 tests / 116 suites**:
2,240 security checks plus 1,157 API/DB/e2e tests; zero failures, cancellations or skips.
Typecheck, ESLint and Next 15.5.27 production build passed. Clean **70-migration / 28-table**
rebuild/checksums and exact pg_dump/pg_restore (all tables, money, constraints, RLS,
ownership and sequences) passed within the same full run. Existing development data
was preserved. Temporary test/preview clusters and browser tab were cleaned up.
Host: Node 24.15.0 / PostgreSQL 18.6; `.nvmrc` retains Node 22.

`test-results/predeploy-final.log` contains raw local output. docs/18 and docs/19 are
generated from the verified database and actual handler inventory. No tests are excluded
from the complete run. The targeted browser checks found and resolved Origin/Host
normalization, empty account-search validation and missing GSAP-target warnings.

## Dependency and deployment limits

Compatible dependency updates resolve the reported runtime advisories. Installed Next
15.5.27, React 19.2.8, PostCSS 8.5.29, Tailwind 3.4.19 and ESLint 9.39.5 are recorded
from this checkout. `npm audit --omit=dev --json` reports zero production advisories.
The full audit retains seven high development-tool advisory entries rooted in braces
3.0.3/glob parsing. The official registry has no patched braces release for that report;
forcing npm's proposed major framework/tooling changes is not a safe compatible fix.
Build glob inputs are repository configuration, not customer input. Recheck the full
and production audits before deployment and plan a reviewed tooling upgrade.

Live HTTPS, proxy behavior, deployed secure-cookie and security-header verification
remain deferred by the user's earlier instruction. PostgreSQL 18.6/Node 24.15.0 were
available for local tests; `.nvmrc` remains Node 22. A run on the pinned Node/PostgreSQL
production target and peer/lecturer acceptance remain separate verification. Green local
checks do not certify absence of every bug or authorize deployment/publication.
