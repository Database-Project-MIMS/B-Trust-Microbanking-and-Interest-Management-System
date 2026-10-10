# Neon Actions validation — missing test-output directory

2026-10-10 · branch `feat/p06-m02-neon-migrations` · local supplement to PR #94.
User provided run 38033232178's failure log. All security checks passed; API/DB/e2e
checks reported 1,169 passes and one failure. The RPT-01 performance query and
accounting assertions passed, but writing its explain evidence failed with ENOENT:
`test-results/rpt01-runtime-explain.json`. Deployment was skipped by the validation
dependency. This is a clean-checkout output-directory assumption, not a Neon
connection failure. The Node action-runtime deprecation warning was nonfatal.

Blueprint: make the evidence-producing test create its parent directory with
recursive mkdir, matching the adjacent RPT-01 view test. Preserve every database,
accounting and performance assertion. Do not add a workflow-only workaround,
skip tests, weaken the deployment gate or modify migrations/application behavior.
Verify the full isolated runner with test-results initially absent, preserving
previous ignored local outputs before verification. No additional credentials needed.

Test belongs to M2 RPT-01; infrastructure steward ownership is unchanged.
Docker/Neon runtime work already present in the tree is retained separately.
User subsequently authorized separate local commits. No push, PR creation,
merge or live database connection performed.
## Verification and review

`node scripts/verify-phase-01.mjs --tap` started with test-results absent,
matching the hosted fresh-checkout condition. 3,410 tests /116 suites pass:
2,240 security and 1,170 API/DB/e2e, zero failures/cancellations/skips. The
previously failing runtime performance test passes and creates valid JSON explain
evidence with execution below five seconds. Full runner also verifies clean
70-migration rebuild/checksums and backup/restore on its disposable cluster.
Typecheck, full lint and Next production build pass. Runner exits 0 with
`LOCAL VERIFICATION: all checks passed.`
Prior ignored artifacts were restored without overwriting the new explain plans;
the complete pre-run output backup is retained in ignored scratch.

`/review`: plan alignment PASS — the producing test owns directory creation,
with no reliance on another test or workflow setup. System integrity PASS — no
application, schema, credentials, migrations or task acceptance changes.
Correctness PASS — recursive mkdir handles both missing and existing output
directories while preserving performance and accounting checks. No unresolved
implementation findings. Hosted Node 22/PostgreSQL 16 rerun remains an external
check; local host is Node 24.15.0/PostgreSQL 18.6. Neon is not contacted.

`/remember save`: additive memory/state notes preserve prior context. Overview
and tracker corrections document this fix without changing accepted task rows.
Next: user pushes the updated PR branch so Actions tests the committed code.
CI fix commit: `f47ccc8`; Docker runtime/tests are `f94fe86`. Documentation/state
are a separate third local commit. Branch remains feat/p06-m02-neon-migrations.
