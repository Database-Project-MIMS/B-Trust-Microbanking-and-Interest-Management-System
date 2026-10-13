# ADR-0035 — Customer e-mail notifications (transactional outbox)

2026-10-13 · user-authorized scoped enhancement · Phase 7 addendum

## Context
Customers must receive an e-mail when something happens to their account (deposit, withdrawal,
transfer, interest, reversal, opening, holder change, status change, FD opening). The app runs on
Vercel (serverless) against Neon. The team owns no domain, so Resend cannot deliver to arbitrary
addresses; the free option is Gmail SMTP with an App Password.

## Decision
- **Outbox pattern.** Triggers enqueue `notification_outbox` rows inside the business transaction
  (0700). Sending happens after commit, so no mail is sent for rolled-back work and none is lost if the
  process dies. `withTransaction()` retries cannot duplicate mail.
- **Provider:** `nodemailer` over Gmail SMTP (`smtp.gmail.com:465`). Credentials `SMTP_USER` and
  `SMTP_APP_PASSWORD` are Vercel environment variables, never `NEXT_PUBLIC_*`. `nodemailer` is neither
  an ORM nor a BaaS, so AGENTS.md §4 is not triggered. Only `lib/email/mailer.ts` imports it.
- **Delivery:** `after()` kicks `dispatchPending()` after each committing route; a daily Vercel Cron
  (Hobby plan limit) and any external scheduler call `/api/notifications/dispatch` as a retry sweep.
  Rows are leased with `FOR UPDATE SKIP LOCKED`; backoff doubles per attempt, `FAILED` after 5.
- **Privacy:** no balances, masked account numbers, no free-text narration; provider error text is
  never stored (only `SMTP_<code>`).
- **Switch:** `NOTIFICATIONS_ENABLED=true` only on Production. Preview deployments stay silent.
- **Migration number:** 0700 in a new `p07_m00` block, because the reserved blocks end at Phase 6.
  The integration lead should confirm or renumber before merge.

## Consequences
- Seed customers use `@example.invalid` addresses; those rows will fail after 5 attempts. Use real
  Gmail addresses for demo customers.
- Gmail limits sending to roughly 500 messages a day and sends from the Gmail address itself.
  This suits a course demo, not production banking.
- The SMTP protocol has no idempotency key; a crash between send and `markSent` can produce one
  duplicate. The stable `Message-ID` (the notification id) helps mail clients de-duplicate.
- Touches routes owned by other members (one `kickNotificationDispatch()` line each); see the handoff.
