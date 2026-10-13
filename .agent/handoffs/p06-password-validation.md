# Password validation — P06-M02-T05

2026-10-13. The user requests customer and agent password validation and clarifies
the minimum as **at least 8 characters**, plus uppercase, lowercase, number and symbol.
This is a scoped local enhancement on the current checkout. No publication is requested.

Implementation plan (/architect): share one password policy between server schemas
and native form constraints/help. Apply it to agent creation, admin login provisioning
(including CUSTOMER/AGENT), admin password changes and single-use reset consumption.
Keep login verification compatible with existing hashes. Preserve the 128-character
maximum and exact password contents; whitespace alone is not a symbol.

M2 contributes required M1 admin/reset forms and shared HTTP validation feedback;
original ownership remains unchanged. Customer registration itself has no password:
optional customer logins are provisioned through Users and access. No migration:
docs/07 explicitly classifies complexity as server policy, and SQL stores hashes only.
Tests will cover each missing requirement, length boundaries, API bypass attempts,
unchanged hashes/sessions/reset tokens on rejection, and accessible form constraints.

Implementation: shared `password-policy.ts` constants/pattern, `password.ts` Zod
schema and `NewPasswordInput`. Agent validation also runs in the service for
direct callers. Shared error mapping returns fixed policy guidance for invalid
password fields; it never echoes the submitted value or arbitrary Zod messages.

/review:
- Plan alignment: PASS. Minimum clarified to 8; every creation/change/reset path
  uses the policy, while sign-in retains existing verification.
- System integrity: PASS. Server enforcement precedes hashing/writes. No SQL,
  hash, permission, transaction, migration or ownership change. UI imports only
  browser-safe policy constants and reuses the existing field/input/help pattern.
- Production readiness: PASS. Negative
  API cases prove rejection preserves hashes, sessions, customer links and reset
  usage; the same reset link subsequently accepts a valid 8-character password.

/imprint initially saved in `ui-registry.md`: native password/input and help, unique
aria-describedby, required/optional behavior, shared bounds/pattern and autocomplete.

Initial verification environment recovery: sandboxed `initdb` could not rename its
WAL file; the approved runner uses a disposable local cluster outside that sandbox.
Existing DBs remain untouched. Typecheck initially found stale `.next/types` files
for absent change-password page/API routes. `next typegen` regenerated current
validators but did not remove these old files. /recover diagnosed generated-cache
residue; those two files are preserved as ignored `.txt` backups in
`test-results/password-stale-types`, and TypeScript then passed. No source workaround.

Final verification: `node scripts/verify-phase-01.mjs --tap` passed **3,687 tests
across 123 suites** (2,440 security plus 1,247 API/DB/UI), zero failures,
cancellations or skips. Clean 70-migration rebuild/checksums, reseed and exact
backup/restore pass; full typecheck, ESLint and Next 15.5.27 production build pass.
The 47 added checks cover the policy/service, runtime negative/positive API paths
and accessible rendered forms. Log: ignored `test-results/password-verification.log`.
No browser interaction or hosted deployment performed. Disposable cluster stopped
and removed by the runner; existing databases preserved. /review: no open findings.

All five overview work-order tables reviewed; only M2 gets the newly completed
local enhancement note. Task is REVIEW pending user publication/peer review.
/remember initially saved this continuation without replacing prior history in memory.md.
The user subsequently requests a few commits. Delivery is split into three local
commits: server policy/tests (`52baa35`), form guidance/UI tests (`f1a8520`), and documentation.
No push, PR, merge or deployment.

## Updated dev conflict resolution — 2026-10-13

The user requests resolving conflicts with updated dev and checking the combined
implementation. Fetched dev is `3b407d3397b0db98396800b1fc4a2d327923af57`.
Its cleanup intentionally removes `.agent/current-state.md`, `memory.md` and
`ui-registry.md`, and moves member overviews under docs. These are the only three
conflicted paths; password application/test code combines automatically.

/recover: targeted modify/delete resolution. Rebase the three password commits
onto that dev tip and accept its retired-file deletions. The original `4a9064f`
tip is preserved at `refs/codex/backups/password-validation-before-dev-rebase`.
Keep current task/continuation evidence in this handoff, and preserve password
UI guidance in `docs/11_ui-rules.md` instead of recreating the retired registry.
The M2 task note follows the upstream move to `docs/2_Vibodha/00_OVERVIEW.md`.
The old files/history remain recoverable from the original commits.

This cleanup conflicts with historical instructions that reference those retired
files; do not resurrect them. The active password policy, task tracker, ADR and
handoff retain all current implementation decisions. Original ownership and phase
acceptance remain unchanged. Dev's Node 22 engine, AccountSelector simplification/
pageSize correction, posting-performance fixture fix and relocated member docs
are retained. No actual branch merge, remote write or deployment is performed.

Combined-tree verification on dev `3b407d3`: **3,687 checks/123 suites** passed,
with zero failures/cancellations/skips. Clean 70-migration rebuild/checksums,
backup/restore, full typecheck/lint and production build pass. Log:
`test-results/password-dev-verification.log` (ignored).

Production-browser preview on that tree verified customer login creation, agent
creation and reset guidance: minLength 8, maxLength 128, shared character-class
pattern, new-password autocomplete and linked help. Empty required fields reject;
an empty optional password-change field accepts. Synthetic administrator sign-in
and sign-out work; browser console has no warnings/errors. No new password or
profile change was submitted in the UI. Runtime password mutations/rejections
were exercised by the disposable API suite. JSON/screenshots are ignored under
`test-results/password-dev-*`. Browser closed; preview stopped. Existing DBs preserved.

## Second dev update — 2026-10-13

The user reports another dev update and explicitly authorizes necessary local commits,
with no push or PR creation. Fetched dev is now
`1489eb422abc3976cd8429f1a4e3c910753e7c30` (PR #109 / Member 3 corrections).
It changes account/statement/plan presentation, adds 0640 Joint-plan minimum age 18
and updates its tests/contracts. All upstream changes are retained verbatim.
The three local password commits rebase onto this tip without conflicts; the first
verified rebased tip is preserved at `refs/codex/backups/password-validation-dev-3b407d3`.
Password source/tests remain byte-for-byte identical to the original verified delivery.
No new password/schema/financial change is introduced by this contribution.

Verification against this newer 71-migration baseline: in progress. The first
70-migration evidence above must not substitute for this new verification.

### Verification cleanup correction

The first run on 1489eb4 passed all 2,440 security and 1,248 functional assertions,
but two interest/report suites failed in after-hooks with SQLSTATE 42501 from
temporary `DROP DATABASE ... FORCE`. The ops helper closes its client first; a
short-lived privileged/background connection can still overlap the forced drop.
PostgreSQL's [FORCE documentation](https://www.postgresql.org/docs/18/sql-dropdatabase.html)
and [process-array implementation](https://github.com/postgres/postgres/blob/REL_18_STABLE/src/backend/storage/ipc/procarray.c)
show that forced termination adds role checks, whereas ordinary DROP waits for
connections and asks autovacuum workers to exit. Background-worker overlap is
inferred from the teardown-only failures and dedicated fixture connections.

/recover plan: close fixture connections and use ordinary DROP for generated test
databases; do not grant superuser/pg_signal_backend or change financial assertions.
Apply the correction to the ops helper and analogous backup/restore, deployment,
Docker and migration test cleanup. Original M4/M5 stewardship remains; this is
necessary test-harness integration at user direction. Add a database regression
holding a temporary privileged connection until the drop starts, then closing it:
owner cleanup must wait rather than trying to terminate it. Only disposable DBs.

The new database regression reproduces the old FORCE SQLSTATE 42501 with a
temporary privileged connection, observes ordinary owner DROP waiting, closes
that connection and proves the database disappears. The owner stays non-superuser
and non-BYPASSRLS. All 32 focused cleanup/interest/backup/deployment/Docker/migration
checks pass (`test-results/password-cleanup-focused.log`, ignored).

The next full Node 24 run passes the cleanup paths but a Windows audit-test process
exits with 3221226505 before its assertions begin. There is no audit/application
code change. A portable official Node 22.23.3 runtime is downloaded into ignored
scratch and verified against nodejs.org's SHA-256 manifest. Global Node/dependencies
remain unchanged. Final full verification now uses the project's pinned Node 22,
PostgreSQL 18.6, and the same isolated runner without exclusions or skipped tests.

Final latest-dev result: **3,689 tests/123 suites** pass (2,440 security and 1,249
API/DB/UI), zero failures/cancellations/skips. Clean **71-migration** rebuild and
checksum verification, reseed and 28-table exact backup/restore pass. Full TypeScript,
ESLint and Next 15.5.27 production build pass on Node **22.23.3**. Marker:
`LOCAL VERIFICATION: all checks passed.` Log: ignored
`test-results/password-latest-dev-node22.log`. A final fetch still resolves dev to
1489eb4; its full source/migration updates are retained.

Latest production-browser reset-form check passes: min 8, max 128, required,
new-password autocomplete and linked guidance. Its rendered pattern rejects a
plain password and accepts the valid eight-character mixed sample. No credential
is entered or changed in the UI. Console is clear. Screenshot/JSON: ignored
`test-results/password-latest-dev-reset-form.jpg` / `password-latest-dev-browser.json`.
Browser closed and disposable preview stopped; existing databases preserved.

/review: plan alignment PASS; original password code is unchanged, required cleanup
integration has a reproducing DB regression. System integrity PASS; no production
SQL, privilege, financial rule or schema change in this contribution. Production
readiness PASS on the pinned runtime. Initial cleanup/Node24 failures are recorded
above and do not substitute for the final green run. Current continuation belongs
here after the root state/memory/registry retirement; do not recreate those files.
Task/phase acceptance remains REVIEW. Local commit authorized; no push/PR/merge/deploy.
