# Handoff — P07-M05-T01 Gmail verification and email repairs

2026-10-13 · Member 5 · `feat/p07-m00-email-notifications`

## Authorized scope and implementation plan

The user asked to check the existing email branch with their Gmail app password,
fix email-service problems, and send a test to a specified recipient. Sender account
was confirmed by the user; the recipient was subsequently changed to their university
address. Inspect existing outbox/SMTP code, repair demonstrated failures, test in a
disposable database, and send one synthetic message. No live queue dispatch, schema
changes, deployment, merges or PR creation. After verification, the user explicitly
authorized a local commit of the changes. No push is authorized.

## Live result

`scripts/test-email.ts` used the application SMTP mailer to verify Gmail authentication
and send one message with subject **B-Trust Gmail SMTP test**. Gmail accepted it.
The user's screenshot confirms receipt in Spam at 23:02 Asia/Colombo. SMTP delivery
works; inbox placement is not guaranteed. Google recommends marking legitimate mail
as not spam or adding the sender to contacts:
https://support.google.com/mail/answer/16457426.

Credentials are configured only in ignored `.env.local`; automatic queue delivery
is disabled there. The script sends to one explicit address without accessing the DB.
No credential values, customer data or test-recipient data are copied into this receipt.

## Repairs

- Mailer strips Gmail app-password display spaces and trims settings; empty host/port
  use Gmail defaults and empty MAIL_FROM falls back to the authenticated sender.
- TLS is required on supported ports 465/587, with a TLS 1.2 minimum and normal
  certificate verification. Rejected recipients are errors rather than SENT records.
- Nodemailer upgraded from 6.10.1 to 10.1.0, removing its reported advisories.
- Dispatcher leases one row immediately before sending; rows never started because
  the time budget expires do not consume attempts. SMTP stays outside DB transactions.
- Sweep authentication requires the Bearer scheme rather than accepting a bare secret.
- Added transport/configuration regression and queue-budget regression. Corrected an
  existing flaky mask assertion to compare the actual suffix and reject full-number
  disclosure. Nodemailer 10 conditional exports require mocking the same CommonJS
  export used by TypeScript in the test runner; no real SMTP calls occur in unit tests.

## Verification and review

The first all-suite run passed all 2,454 security checks and 848 database/UI checks;
418 of 419 API tests passed, exposing the original uppercase-only mask assertion.
After correcting that assertion, a fresh API verification run passed **419/419**
tests with no failures/skips. Together these verify **3,721 distinct checks**; the
initial all-suite log retains its one historical failure. No unchanged suite was
excluded. Logs are ignored `test-results/email-verification.log` and
`test-results/email-api-verification.log`.

Node 22.23.3 / PostgreSQL 18.6. Clean **72-migration** rebuild/checksums, typecheck,
lint and Next.js 15.5.27 production build pass. Both disposable clusters are cleaned
up; existing development data is preserved; migration 0700 is unchanged.

`/review`: plan alignment PASS (one explicit SMTP test, scoped repairs);
system integrity PASS (server-only mailer, parameterized queue SQL, SMTP outside DB
transactions, no credentials in tracked files); readiness PASS within local scope
(TLS, rejected-recipient handling, retries/concurrency/budget and worker-auth checks).
No unresolved finding in the repaired code. Hosted delivery and Spam placement
remain the explicit limits above.

The seven remaining npm audit findings are in existing development tooling
(Tailwind/ESLint transitive glob dependencies); upgrading the UI stack is outside
this SMTP repair. Runtime dependency audit is recorded after the patched install.

## Stewardship and deployment

Existing notification files were introduced as integration-owned P07-M00 work.
The user explicitly requested Member 5 verification and repairs. This follow-up
touches only notification code/tests, its dependency, and related docs/state; no
other members' business routes or existing migrations are changed. Stewardship is
unchanged. All five member overview tables were reviewed; other members gain no
new completed tasks from this work.

Hosted notifications still require SMTP settings, notifications enabled, a worker
secret, migration 0700 on the hosted database, and deployment through the normal
workflow. Local successful SMTP verification does not certify the deployed queue.

The runtime-only npm audit reports **zero vulnerabilities**. All five overview
tables were reviewed; only Member 5 gains a new completed implementation row. The
previously absent current-state/memory files now contain this scoped handoff state.
