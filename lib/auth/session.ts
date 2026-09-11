import { randomBytes, createHash } from "node:crypto";
import { query, queryOne } from "@/lib/db";


export const SESSION_COOKIE_NAME = "mims_session";
const IDLE_TIMEOUT_MINUTES = 20;

export interface SessionData {
    sessionId: string;
    userId: string;
    username: string;
    roleId: string;
    roleName: string;
}

export function hashToken(token: string): string {
    return createHash("sha256").update(token).digest("hex");
}

export async function createSession(
    userId: string,
    ipAddress?: string,
    userAgent?: string
): Promise<{ token: string; expiresAt: Date }> {
    const token = randomBytes(32).toString("hex");
    const tokenHash = hashToken(token);
    const expiresAt = new Date(Date.now() + IDLE_TIMEOUT_MINUTES * 60 * 1000);
    await query(
        `INSERT INTO user_session (user_id, token_hash, expires_at, ip_address, user_agent)
     VALUES ($1, $2, $3, $4, $5)`,
        [userId, tokenHash, expiresAt, ipAddress ?? null, userAgent ?? null]
    );
    return { token, expiresAt };
}


/**
 * Validates a session token received from a request cookie.
 */
export async function validateSession(token: string): Promise<SessionData | null> {
    const tokenHash = hashToken(token);
    const session = await queryOne<SessionData>(
        `SELECT 
        s.session_id AS "sessionId",
        u.user_id AS "userId",
        u.username AS "username",
        r.role_id AS "roleId",
        r.role_name AS "roleName"
     FROM user_session s
     JOIN app_user u ON s.user_id = u.user_id
     JOIN role r ON u.role_id = r.role_id
     WHERE s.token_hash = $1
       AND s.revoked_at IS NULL
       AND s.expires_at > now()
       AND u.status = 'ACTIVE'`,
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