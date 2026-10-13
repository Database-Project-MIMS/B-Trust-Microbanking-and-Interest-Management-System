# Handoff — customer e-mail notifications (ADR-0035)

**What changed**
- Migration `0700_p07_m00_notification_outbox.sql` (table, enqueue function, four triggers, guard,
  grants). It must reach Neon via the normal migration job BEFORE the code is deployed.
- `lib/email/{mailer,templates,kick}.ts`, `services/notification-service.ts`,
  `app/api/notifications/dispatch/route.ts`, `vercel.json` cron, `.env.example`.
- One added line `kickNotificationDispatch();` before the success response in: transactions
  (deposits, withdrawals, transfers, `[id]/reverse`), accounts (`route`, `[id]`, `[id]/holders`,
  `[id]/close`), `fixed-deposits`, `interest-runs`. Owners: please review; behaviour is unchanged.
- Tests: `tests/db/notification-outbox.test.mjs`, `tests/api/notification-dispatch.test.mjs`.

**Vercel setup (user)**: set `SMTP_USER`, `SMTP_APP_PASSWORD`, `MAIL_FROM`,
`NOTIFICATIONS_ENABLED=true`, `CRON_SECRET` on Production only; redeploy.
Demo customers need real Gmail addresses (seed `@example.invalid` rows will end `FAILED`).
