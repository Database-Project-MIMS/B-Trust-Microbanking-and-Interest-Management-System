# 25 — Automatic interest processing on Vercel

The scheduler calls GET /api/cron/interest daily using `30 18 * * *` (18:30 UTC,
00:00 Asia/Colombo). Daily polling finds FD periods due every 30 days, catches up all
unpaid due periods through maturity, posts savings for unpaid funded days using the
existing daily closing-balance SQL, and returns eligible matured principal once.
Money calculations remain PostgreSQL NUMERIC; the FD rate is the opening snapshot.

Set CRON_SECRET explicitly in Vercel Production and redeploy this branch. Vercel sends
that configured value as Authorization: Bearer <secret>; it does not generate the secret.
Runtime DATABASE_URL must use the migrated restricted application role. Seeded active
SYSTEM user and SYSTEM transaction channel are required. Set PGPOOL_MAX to at least 2
(default 10), since a control lock connection and a distribution connection are used.
The bank date is fixed to Asia/Colombo to match database validation, regardless of
BANK_TIMEZONE. Query parameters are rejected. Cookie sessions cannot trigger GET;
manual ADMIN/CENTRAL_OPS operations use POST /api/interest-runs with CSRF protection.

The route is dynamic, sends Cache-Control: no-store, and allows 300 seconds. Only one
service run can process at a time across all cycle dates, protected by a PostgreSQL
transaction advisory lock that works with Neon's transaction pooler. This outer transaction
owns only the lock; each FD period, savings payout and maturity operation commits separately.
A successful completed cycle replays its stored result. An interrupted RUNNING cycle
resumes from committed cursors once the previous runner releases its lock. FAILED controls
remain operator-reviewed. A run with exceptions retains their count and audit evidence;
the next day's sweep retries outstanding eligible work. Monitor exceptionCount as well as HTTP status.

Vercel does not retry failed cron invocations. If an invocation times out, invoke the same
secret-authenticated endpoint again on the same bank date or use the manual console with
that cycle date. A later day's sweep catches up unpaid work. Completed same-date replay
does not retry that day's exceptions. Verify hosted cron execution in Vercel logs and
interest_run/interest_payout after deployment; local tests cannot prove hosted scheduling.

References: [Vercel cron management](https://vercel.com/docs/cron-jobs/manage-cron-jobs),
[Vercel scheduling limits](https://vercel.com/docs/cron-jobs/usage-and-pricing).

Regression coverage: tests/api/interest-cron.test.mjs (secret denial, no cookie GET,
query rejection, Colombo date boundaries, six exact FD periods, savings daily balance,
principal return, audit and replay); tests/db/savings-maturity.test.mjs (committed partial
resume, cross-cycle overlap, lock release plus existing financial/rollback checks).
Verification uses npm run verify:phase1 -- --tap on a disposable PostgreSQL cluster.

Final local evidence (2026-10-13): 3,662 distinct passing checks after the corrected
API rerun; 70-migration isolated rebuild/restore, typecheck, lint and production build
passed. P06-M05-T03 is REVIEW pending user publication and hosted cron confirmation.
