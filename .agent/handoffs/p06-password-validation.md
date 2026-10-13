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

/imprint saved in `ui-registry.md`: native password/input and help, unique
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
/remember saves this continuation without replacing prior history in memory.md.
The user subsequently requests a few commits. Delivery is split into three local
commits: server policy/tests (`52baa35`), form guidance/UI tests (`f1a8520`), and documentation.
No push, PR, merge or deployment.
