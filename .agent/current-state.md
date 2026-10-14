# Current state — dev/main conflict resolution

## Latest scoped delivery — customer transfers and methods

Git follow-up 2026-10-14: the branch base is now latest main `6a79dcb` (PR #117),
with mistaken main tracking removed. All 47 implementation files are preserved;
no conflict/staged files remain. No commit or push. Publish the feature branch
after committing; preserve the existing verified product implementation.

2026-10-14 · P06-M04-T03 REVIEW · `feat/p06-m04-customer-transfer-method`, based
on freshly fetched main `56886a3`. Customer withdrawals are replaced by owned-source
transfers to other customers; staff deposits/withdrawals use Cash/Cheque methods.
Migration 0660 is included, applied only to disposable verification databases.
Node 22: 3,770 checks/129 suites; clean 73-migration rebuild/29-table restore,
typecheck/lint/build and production browser QA pass. Review/imprint recorded in
handoffs/p06-m04-customer-transfer-method.md and docs/11. Preview resources stopped.
Work remains uncommitted and unpushed; user controls publication and deployment.
Earlier state below is historical and does not authorize commits for this request.

2026-10-13 (Asia/Colombo). User authorized resolving PR #113 conflicts and
committing locally on dev, without pushing. Merge parents: dev e4e270f and
main d79e92b. Both email notification and automatic interest implementations,
schedules, environment placeholders and documentation are retained. Both worker
endpoints use the security matrix machine-authentication classification.

Earlier receipts below describe their original sessions. This integration does
not change task acceptance or certify hosted scheduling/delivery.
See handoffs/dev-main-conflict-resolution.md for validation and next steps.

## Prior Gmail verification receipt

2026-10-13 · Member 5 · `feat/p07-m00-email-notifications`

User authorized P07-M05-T01: test Gmail authentication/delivery and fix the existing
email service. Gmail authentication succeeded and one synthetic email was accepted
for the user-specified recipient. No bank transaction or live outbox dispatch.

Local repairs: normalized app passwords, blank sender fallback, required TLS,
recipient acceptance checks, patched Nodemailer, strict Bearer scheme, and one-row
claims so unstarted work cannot consume attempts. Regression verification
on Node 22 with a disposable PostgreSQL cluster is complete: 2,454 security and
848 DB/UI checks pass; corrected API rerun passes 419 tests. Clean 72-migration
rebuild, typecheck, lint and production build pass. Runtime npm audit reports zero
vulnerabilities. The user's screenshot confirms the synthetic email arrived in Spam.

Credentials are in ignored `.env.local`; automatic delivery is disabled there.
No credential values belong in project state, memory, tests or receipts.
The user subsequently authorized a local commit. No merges, pushes, PR creation
or deployment are authorized for this task. P07-M05-T01 is REVIEW; hosted queue
verification remains separate.

## Prior automatic interest cron receipt

2026-10-13 · feat/vercel-interest-cron · P06-M05-T03 REVIEW.
User-authorized Member 5 inspection/repair is locally verified. Exact cron authentication,
Colombo date handling, run serialization, interrupted-control recovery and financial
regressions are implemented. 3,662 distinct checks pass after the corrected API rerun;
clean 70-migration rebuild/restore, typecheck, lint and production build pass.
See handoffs/interest-cron-review.md and docs/25_vercel-interest-cron.md.
No commits/publication/deployment. Hosted scheduling requires configured CRON_SECRET,
application database credentials, migrated schema/system seed and a deployment/log check.
The previous .agent state was removed by the branch's earlier cleanup; this note records
only this scoped repair and does not infer broader phase acceptance.

The user subsequently authorized a local commit of the verified repair. Publication
beyond that local commit and hosted scheduling verification remain pending.
