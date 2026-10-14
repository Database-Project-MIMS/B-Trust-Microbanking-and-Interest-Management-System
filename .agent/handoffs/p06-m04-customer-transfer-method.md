# P06-M04-T03 — Customer transfer/method handoff

**Git repair — 2026-10-14:** Removed the mistaken origin/main upstream; this is
an unpublished feature branch. Updated its base to latest main `6a79dcb` (PR #117),
restored all 47 changed files and verified their Git content hashes against the
preservation snapshot. Incoming changes only retire old agent/skill notes; product
code is identical to the verified base. No unmerged or staged files remain, and no
feature commit or push was made. Commit changes, then publish this feature branch;
do not set its upstream back to main. Earlier verification/base details below
describe the implementation session. The preserved current-state note is now
untracked because latest main removed the former .agent directory.

2026-10-14. User-requested cross-owner contribution, ADR-0036.
Branch `feat/p06-m04-customer-transfer-method` starts at latest origin/main.
Necessary shared changes: M1 dashboard/navigation/authorization/security matrix;
M3 schema/rule documentation; M4 posting/transfer service/API/UI/migration/tests.
No ownership reassignment; no commit/push/PR/merge/deployment.

Base: origin/main `56886a3` (PR #115), fetched 2026-10-14. Working tree is
uncommitted. Migration `0660_p06_m04_customer_transfers_methods.sql` must be applied
to the intended development/deployment database before running these screens.
Only disposable verification databases were migrated in this session.

Implemented: customer dashboard/menu/legacy redirect now offer Transfers;
customer withdrawal page/API/service/core deny access and the legacy wrapper grant
is revoked. Customer transfer source ownership, other-holder destination, active
stored actor, mandate, business hours, minimum and shared debit limits are checked
in SQL under account locks. Cross-branch recipients work; recipient balance/credit
receipt identifiers remain private. Existing staff transfers retain their contract.
Staff posting APIs use method=CASH|CHEQUE, persisted with existing reference FKs;
historical transaction/channel rows are retained. Cheques post immediately using
the existing workflow; a cheque-clearance lifecycle was not requested.

Final verification: Node 22.23.3 / PostgreSQL 18, `verify:phase1 -- --catalog --tap`:
**3,770 checks / 129 suites**, zero failures/skips/cancellations (2,477 security,
1,293 API/DB/UI). Clean **73-migration / 29-table** rebuild, checksums, exact
pg_dump/pg_restore, typecheck, ESLint and production build pass.
Detailed ignored logs: test-results/customer-transfer-full.log.
The new tests cover paired cross-branch postings, ownership/signer/actor forgery,
CSRF, exact money, duplicate and distinct concurrent transfers, replay payload binding,
mandate/status/funds/minimum rejection, audit-fault rollback, method persistence,
SQL capabilities and native rendered forms. Deployment/Docker completeness checks
derive migration counts from the migration inventory instead of the stale count 72.

Earlier Node 24 run had a native test-process crash/report timeout; required Node 22
full rerun passes without exclusions or weakened performance assertions. Sandbox
PostgreSQL/Next output restrictions were resolved through authorized execution of
the same disposable verification/build commands. Existing databases are preserved.

Production browser QA: synthetic customer dashboard/menu show Transfers, owned
source selection and recipient-number/review fields work, direct withdrawal URL
returns to dashboard. Staff deposit and withdrawal forms offer Cash/Cheque; selecting
Cheque works. Browser confirmation was reviewed; financial posting is proved by
the API/SQL regressions. Preview tab/server/temporary database cluster are stopped.

/review: plan alignment PASS; architecture/security integrity PASS; UI/runtime
readiness PASS. No unresolved finding within this request. /imprint recorded in
docs/11_ui-rules.md (the root registry was retired); original stewardship remains.
P06-M04-T03 is REVIEW pending user publication/peer acceptance, with no general phase
approval or hosted deployment claimed. No commit, push, merge or PR was created.
