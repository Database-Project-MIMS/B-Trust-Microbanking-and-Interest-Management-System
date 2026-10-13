# Automatic interest cron review — 2026-10-13

User authorized inspection and fixes on feat/vercel-interest-cron for Member 5.
This scope includes the cron handler, interest service, focused regression tests,
and supporting DB lock and shared security matrix/docs. Stewardship stays unchanged.
The branch's cleanup commit removed prior .agent state and memory; historical document
links therefore remain stale and do not block the explicit repair request.

Architect decisions: keep SQL NUMERIC formulas and separate distribution transactions;
use secret-only GET for Vercel, existing CSRF-protected POST for manual operators;
use Asia/Colombo consistently with SQL; serialize services across cycle dates and resume
interrupted RUNNING controls from committed FD/savings cursors without resetting totals.
No migrations, UI changes, commits, pushes, merges or PRs are required for this repair.

Cross-owner addition: lib/db/interest-run-lock.ts (DB infrastructure) owns the control-only
advisory transaction. Financial distributions use separate pooled connections and commit
individually. The lock is transaction-scoped for Neon/PgBouncer compatibility; PGPOOL_MAX
must be at least 2. Shared endpoint security tests and docs reflect secret-only cron access.

Review findings addressed: cookie-authenticated financial GET bypassed CSRF; loose bearer
parsing accepted raw secrets; configurable timezone disagreed with SQL; missing route tests;
interrupted controls blocked same-date recovery; overlapping dates could misattribute totals.
CRON_SECRET example incorrectly claimed Vercel created the secret automatically.

Verification receipt will be appended after the isolated suite completes.

The existing finalization-fault test formerly required operator review (409). It now
asserts retry still fails safely while the synthetic fault exists (500), then resumes to
COMPLETED after removing the fault, with exactly one payout and unchanged balance.

## Final verification and review

Local verification passed on 2026-10-13: 2,455 security checks plus 835 DB/UI checks
from the full disposable run, and all 372 API checks from the corrected fresh-cluster
API rerun: 3,662 distinct checks, with no remaining failures/skips. The first full run
had one outdated recovery expectation; the corrected entire API suite passed afterward.
Clean 70-migration rebuild/checksums, pg_dump/pg_restore, exact payout/reconciliation,
negative rollback cases, typecheck, ESLint and Next.js production build passed.
Logs: test-results/interest-cron-verification.log, interest-cron-api.log,
interest-cron-build.log. Test clusters were cleaned by the runner; existing DB preserved.
Host Node 24.15.0/PostgreSQL 18.6; project pin remains Node 22.

/review: plan alignment PASS (scheduler, exact existing financial routines, recovery).
System integrity PASS (route -> service -> DB; per-distribution commits; NUMERIC money;
strict cron bearer and manual CSRF; bank date agrees with SQL; no migrations edited).
Production readiness PASS locally (date boundaries, denied requests, replay, maturity,
savings, overlapping controls, fault persistence/removal and lock release covered).
Hosted cron execution/configuration has not been tested or deployed. Daily savings
settlement follows the existing service policy; this repair does not change that policy.

Task P06-M05-T03 is REVIEW, pending user publication and hosted confirmation.
No commits, pushes, merges or PRs were performed. Working checkout remains
feat/vercel-interest-cron. All five overview tables were reviewed; no existing task was
newly accepted. New local state/memory records replace no previous retained files.

Publication update: the user explicitly authorized committing these verified changes
in this chat. Local commit is authorized; push, merge, PR and deployment remain separate.
