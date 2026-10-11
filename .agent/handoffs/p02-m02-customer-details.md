# P02-M02-T06 — Customer registration and assigned-agent details

Date: 2026-10-11. Branch: `feat/p02-m02-customer-details`.
Authority/blueprint: ADR-0033 and the user's explicit clarification.

Registration uses a native Male/Female select with an optional empty prompt, submitting
MALE/FEMALE. Server validation rejects other supplied strings/types. Existing nullable
varchar storage and historical gender values remain unchanged; no migration added.

Customer search and profiles return complete NIC/passport and email to the current
assigned AGENT after the existing stored-actor, branch and assignment SQL checks.
BRANCH_MANAGER response masking and audit identity/email masking remain unchanged.
Each result has an accessible View details link to the existing authorized profile;
the profile now includes gender and an explicit NIC/passport label alongside contact
data, assignment history, document metadata, savings accounts and fixed deposits.

Changes stay in M2's customer domain, with the shared UI registry and documentation
updated as required. Original stewardship is retained. Existing T05 remains DONE;
the follow-up remains REVIEW after local verification, pending user publication/review.
All five overview summaries were reviewed; no other member's task newly completes.

## Verification and review

API coverage includes MALE/FEMALE/omitted gender, invalid choices with no writes,
full assigned-agent fields in search/profile and access loss after reassignment.
Existing branch/role/self/assignment denial and masked-audit tests remain mandatory.
The ordinary verification harness rebuilds only a disposable local database.
The sandboxed initdb hit the known Windows WAL rename restriction; verification is
rerun outside the sandbox without changing implementation or database safeguards.

Final automated verification passes: 3,417 tests / 117 suites, zero failures,
cancellations or skips; clean 70-migration rebuild/checksum and existing SQL/backup
checks, TypeScript, ESLint and the production build. Log (ignored):
`test-results/customer-details-verification.log`.

Production browser QA passes as the disposable agent: both gender options are
selectable with correct underlying values; synthetic Female registration succeeds
and opens the profile with gender, full NIC/email, phone and address. View details
opens an existing customer with assignment history, savings and FD panels. Loading
and empty results display correctly. Profile and list have no document overflow at
390x844; the wide table scrolls within its container. No captured browser warnings
or errors. Role/branch/reassignment denials and audit masking are verified by API
tests. The browser was signed out and closed, viewport restored, preview stopped.

Review: plan alignment PASS, system integrity PASS, production-preview readiness
PASS; no unresolved findings. /imprint records existing tokens. Deployment remains
the user's next step; this is local implementation evidence, not live verification.
No local development or live customer database is reset or modified for QA.
The earlier live agent credential check was a login/logout only.

Review benchmark: ADR-0033. Plan alignment covers all three requested UI changes;
system review covers server shaping/validation, SQL scope, existing RLS, audit privacy,
token reuse and no new database objects. Browser review checks actual selection,
detail navigation and loading/empty/denied states, with mobile layout inspection.

Local commits are explicitly authorized. No push, PR creation, merge or deployment.
Publish through the user's normal process and retest the deployed app afterwards.

## PR #97 integration preparation — 2026-10-11

PR #97 targets main and currently ends at 26b315e. Merge it before publishing this
customer follow-up. Its Vercel build decision retains ADR-0032; the customer
decision and all references are renumbered ADR-0033. Customer memory/overview
notes use separate insertion points so both branches preserve their session notes.
The preparation changes Markdown only; no branch merge, push or PR is performed.
The 3,417-test result above predates the two PR #97 supplements. Run the combined
verification after incorporating merged main before publication.

Read-only three-way checks against PR #97 head 26b315e pass for all 14 existing
Markdown files changed by this customer branch. Both PR #97 session notes and the
customer notes survive the merge; the added customer ADR no longer collides with
PR #97's ADR number. Markdown whitespace checks pass. Recheck if PR #97 changes.
