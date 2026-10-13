import "server-only";
import { withTransaction } from "@/lib/db";
import { notificationsEnabled, smtpMailer, type Mailer } from "@/lib/email/mailer";
import { renderEmail } from "@/lib/email/templates";

const MAX_ATTEMPTS = 5;
const LEASE_SECONDS = 120;
const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 50;
const TIME_BUDGET_MS = 8000;

export interface DispatchResult {
  enabled: boolean;
  claimed: number;
  sent: number;
  retried: number;
  failed: number;
}

export interface DispatchOptions {
  limit?: number;
  /** Test seam; production always uses the SMTP mailer. */
  mailer?: Mailer;
  /** Test seam; bypasses the environment switch. */
  force?: boolean;
}

interface ClaimedRow {
  notificationId: string;
  eventType: string;
  toEmail: string;
  payload: Record<string, unknown>;
  attempts: number;
}

/** One short transaction leases due rows (FOR UPDATE SKIP LOCKED); the lease lapses if the worker dies. */
async function claimDue(limit: number): Promise<ClaimedRow[]> {
  return withTransaction(async tx => (await tx.query<ClaimedRow>(
    `UPDATE notification_outbox n
        SET attempts = n.attempts + 1,
            next_attempt_at = now() + make_interval(secs => $2::int)
      WHERE n.notification_id IN (
              SELECT notification_id FROM notification_outbox
               WHERE status = 'PENDING' AND next_attempt_at <= now()
               ORDER BY next_attempt_at, created_at
               LIMIT $1 FOR UPDATE SKIP LOCKED)
      RETURNING n.notification_id AS "notificationId", n.event_type AS "eventType",
                n.to_email AS "toEmail", n.payload, n.attempts`,
    [limit, LEASE_SECONDS])).rows);
}

/** One short transaction records a successful send. */
async function markSent(notificationId: string): Promise<void> {
  await withTransaction(async tx => {
    await tx.query(
      `UPDATE notification_outbox SET status = 'SENT', sent_at = now(), last_error = NULL
        WHERE notification_id = $1 AND status = 'PENDING'`, [notificationId]);
  });
}

/** One short transaction schedules a retry with exponential backoff, or gives up after MAX_ATTEMPTS. */
async function markFailure(row: ClaimedRow, code: string): Promise<"retried" | "failed"> {
  const giveUp = row.attempts >= MAX_ATTEMPTS;
  const backoffSeconds = Math.min(60 * 2 ** row.attempts, 3600);
  await withTransaction(async tx => {
    await tx.query(
      `UPDATE notification_outbox
          SET status = CASE WHEN $2::boolean THEN 'FAILED' ELSE status END,
              next_attempt_at = now() + make_interval(secs => $3::int),
              last_error = $4
        WHERE notification_id = $1 AND status = 'PENDING'`,
      [row.notificationId, giveUp, backoffSeconds, code]);
  });
  return giveUp ? "failed" : "retried";
}

/** Keeps only a short error code; provider messages can echo addresses, so they are never stored or logged. */
function errorCode(error: unknown): string {
  const code = typeof error === "object" && error !== null && "code" in error ? String((error as { code: unknown }).code) : "SEND_FAILED";
  return `SMTP_${code}`.replace(/[^A-Za-z0-9_]/g, "").slice(0, 60);
}

/**
 * Sends due notifications. Transaction boundary: claim, mark-sent and mark-failure are separate short
 * transactions; no transaction is held open across the network call.
 */
export async function dispatchPending(options: DispatchOptions = {}): Promise<DispatchResult> {
  const result: DispatchResult = { enabled: true, claimed: 0, sent: 0, retried: 0, failed: 0 };
  if (!options.force && !notificationsEnabled()) return { ...result, enabled: false };

  const limit = Math.min(Math.max(Math.trunc(options.limit ?? DEFAULT_LIMIT), 1), MAX_LIMIT);
  const mailer = options.mailer ?? smtpMailer;
  const deadline = Date.now() + TIME_BUDGET_MS;
  const rows = await claimDue(limit);
  result.claimed = rows.length;

  for (const row of rows) {
    // Unprocessed rows keep their lease and are retried after it lapses.
    if (Date.now() > deadline) break;
    try {
      const rendered = renderEmail({ eventType: row.eventType, payload: row.payload });
      await mailer.send({ to: row.toEmail, messageId: row.notificationId, ...rendered });
      await markSent(row.notificationId);
      result.sent += 1;
    } catch (error) {
      const outcome = await markFailure(row, errorCode(error));
      result[outcome] += 1;
      console.error(`[notifications] send ${outcome} event=${row.eventType} attempt=${row.attempts} code=${errorCode(error)}`);
    }
  }
  return result;
}
