import { randomBytes, createHash } from "node:crypto";
import { pool, query, queryOne, type Executor } from "@/lib/db";


export const SESSION_COOKIE_NAME = "mims_session";

export interface SessionData {
    sessionId: string;
    userId: string;
    username: string;
    roleId: string;
    roleName: string;
    branchId: string | null;  // null = bank-wide roles (ADMIN, AUDITOR, etc.)
}

export function hashToken(token: string): string {
    return createHash("sha256").update(token).digest("hex");
}

export async function createSession(
    userId: string,
    ipAddress?: string,
    userAgent?: string,
    executor: Executor = pool,
): Promise<{ token: string; expiresAt: Date; cookieExpiresAt: Date }> {
    const token = randomBytes(32).toString("hex");
    const tokenHash = hashToken(token);
    const result = await executor.query<{ expiresAt: Date; cookieExpiresAt: Date }>(
        `INSERT INTO user_session (user_id, token_hash, expires_at, ip_address, user_agent)
         VALUES ($1, $2, LEAST(
           now() + COALESCE((SELECT param_value::int FROM system_parameter WHERE param_key = 'SESSION_IDLE_TIMEOUT_MINUTES'), 20) * interval '1 minute',
           now() + COALESCE((SELECT param_value::int FROM system_parameter WHERE param_key = 'SESSION_ABSOLUTE_TIMEOUT_HOURS'), 8) * interval '1 hour'
         ), $3, $4) RETURNING expires_at AS "expiresAt",
           created_at + COALESCE((SELECT param_value::int FROM system_parameter WHERE param_key = 'SESSION_ABSOLUTE_TIMEOUT_HOURS'), 8) * interval '1 hour' AS "cookieExpiresAt"`,
        [userId, tokenHash, ipAddress ?? null, userAgent ?? null]
    );
    const row = result.rows[0];
    if (!row) throw new Error('Session creation failed.');
    return { token, expiresAt: row.expiresAt, cookieExpiresAt: row.cookieExpiresAt };
}


/**
 * Validates a session token received from a request cookie.
 * Returns the session data including branchId for scope enforcement.
 */
export async function validateSession(token: string): Promise<SessionData | null> {
    const tokenHash = hashToken(token);
    const session = await queryOne<SessionData>(
        `WITH live_session AS (
          UPDATE user_session s
          SET expires_at = LEAST(
            now() + COALESCE((SELECT param_value::int FROM system_parameter WHERE param_key = 'SESSION_IDLE_TIMEOUT_MINUTES'), 20) * interval '1 minute',
            s.created_at + COALESCE((SELECT param_value::int FROM system_parameter WHERE param_key = 'SESSION_ABSOLUTE_TIMEOUT_HOURS'), 8) * interval '1 hour'
          )
          WHERE s.token_hash = $1 AND s.revoked_at IS NULL AND s.expires_at > now()
            AND s.created_at + COALESCE((SELECT param_value::int FROM system_parameter WHERE param_key = 'SESSION_ABSOLUTE_TIMEOUT_HOURS'), 8) * interval '1 hour' > now()
          RETURNING s.session_id, s.user_id
        ) SELECT
            s.session_id   AS "sessionId",
            u.user_id      AS "userId",
            u.username     AS "username",
            r.role_id      AS "roleId",
            r.role_name    AS "roleName",
            a.branch_id    AS "branchId"
         FROM live_session s
         JOIN app_user u  ON s.user_id = u.user_id
         JOIN role r      ON u.role_id = r.role_id
         LEFT JOIN agent a ON a.agent_id = u.user_id
         WHERE u.status = 'ACTIVE' AND r.status = 'ACTIVE'
           AND (r.role_name NOT IN ('AGENT', 'BRANCH_MANAGER') OR a.status = 'ACTIVE')`,
        [tokenHash]
    );
    return session;
}


export async function revokeSessionByToken(token: string): Promise<void> {
    const tokenHash = hashToken(token);
    await query(
        `UPDATE user_session 
     SET revoked_at = now() 
     WHERE token_hash = $1 AND revoked_at IS NULL`,
        [tokenHash]
    );
}
