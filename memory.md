# Memory — dev/main conflict resolution

Last updated: 2026-10-13 (Asia/Colombo).

PR #113: merge main d79e92b into dev e4e270f, resolve nine conflicting files,
retain both features and schedules, and commit locally. User will push dev.
Both scheduler endpoints are classified as machine-authenticated in the
security matrix. Prior session memories are retained below as history; their
publication restrictions describe those earlier sessions. Current authorization
permits this local merge commit only. See .agent/handoffs/dev-main-conflict-resolution.md
for verification. Next: user pushes dev, then checks PR #113.

## Prior Gmail session memory

Last updated: 2026-10-13 (Asia/Colombo)

## What was built

Email repairs on `feat/p07-m00-email-notifications`: app-password normalization,
TLS requirements, blank sender fallback, recipient acceptance checks, strict Bearer
authentication and one-row dispatch claims. Nodemailer is patched to 10.1.0.
Added `scripts/test-email.ts` and transport/queue regression coverage.

## Decisions made

Use the existing SMTP/outbox architecture. No new migration or live queue dispatch.
Automatic local notifications remain disabled; credentials are in ignored local
configuration and must never be copied into memory or tracked files.

## Current state

Gmail authentication succeeded. One authorized synthetic test was accepted and the
user's screenshot confirmed receipt in Spam. Inbox placement needs recipient-side
Not spam/contact settings. No further test email is needed.

Security checks and DB/UI tests passed. A flaky uppercase-only account mask test was
fixed; all 419 API tests passed in a fresh run. Typecheck, lint, the production build
and clean 72-migration rebuild passed. See `.agent/handoffs/p07-m05-gmail-verification.md`.

## Next session starts with

Read the verification handoff. Hosted SMTP environment settings, worker secret,
migration 0700 and deployment remain separate work. The user authorized committing
these repairs locally after verification. No pushes, PRs, merges or deployment.

## Open questions

No credential or local SMTP blocker. Hosted queue delivery is not certified here.

## Prior automatic interest cron session memory

Last updated: 2026-10-13, Asia/Colombo.

User requested review and fixes on feat/vercel-interest-cron. Local changes secure the
cron GET, align its date to database Asia/Colombo, serialize service runs, and resume
interrupted RUNNING controls from committed cursors. No financial formula/schema/UI
changes. Tests and deployment guide added; handoff includes cross-owner infrastructure.

Verification: 3,662 distinct checks across security/DB/UI and the corrected API rerun;
70-migration isolated rebuild/restore, typecheck, lint and build pass. The initial full
run had one outdated finalization-recovery test expectation; all 372 API tests passed
on its fresh-cluster rerun. Evidence: .agent/handoffs/interest-cron-review.md.

P06-M05-T03 REVIEW; all changes uncommitted. No push, merge, PR or live deployment.
Next: review diff, configure CRON_SECRET in Vercel Production, deploy at the user's
request, and verify hosted cron logs and payouts. Setup: docs/25_vercel-interest-cron.md.
Existing memory was absent on this branch; no previous memory was overwritten.

Follow-up: the user explicitly requested a local commit of all verified repair changes.
Push, PR, merge and deployment have not been requested.
