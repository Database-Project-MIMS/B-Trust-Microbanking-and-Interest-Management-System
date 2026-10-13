# Memory — Member 5 Gmail verification

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
