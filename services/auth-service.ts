import { query, queryOne, withTransaction } from "@/lib/db";
import { verifyPassword } from "@/lib/auth/password";
import { createSession, revokeSessionByToken } from "@/lib/auth/session";

export interface LoginResult {
  success: boolean;
  statusCode: number;
  error?: { code: string; message: string };
  user?: { id: string; username: string; role: string };
  sessionToken?: string;
  sessionExpiresAt?: Date;
}

interface UserRow {
  user_id: string;
  username: string;
  password_hash: string;
  status: string;
  role_name: string;
}

export async function login(
  username: string,
  password: string,
  ipAddress?: string,
  userAgent?: string
): Promise<LoginResult> {
  // 1. Check failed attempts throttling (5 attempts within 15 minutes)
  const recentFailures = await queryOne<{ count: string }>(
    `SELECT COUNT(*)::text AS count 
     FROM login_attempt
     WHERE username_attempted = $1
       AND success = false
       AND attempted_at > now() - interval '15 minutes'`,
    [username]
  );

  if (Number(recentFailures?.count ?? 0) >= 5) {
    return {
      success: false,
      statusCode: 429,
      error: {
        code: "TOO_MANY_ATTEMPTS",
        message: "Account temporarily locked due to too many failed login attempts. Try again later.",
      },
    };
  }

  // 2. Fetch user by username
  const user = await queryOne<UserRow>(
    `SELECT u.user_id, u.username, u.password_hash, u.status, r.role_name
     FROM app_user u
     JOIN role r ON u.role_id = r.role_id
     WHERE u.username = $1`,
    [username]
  );

  // 3. Constant generic message to avoid leaking username existence
  const genericError: LoginResult = {
    success: false,
    statusCode: 401,
    error: {
      code: "INVALID_CREDENTIALS",
      message: "Invalid username or password",
    },
  };

  if (!user) {
    // Record failed attempt
    await query(
      `INSERT INTO login_attempt (username_attempted, success, ip_address)
       VALUES ($1, false, $2)`,
      [username, ipAddress ?? null]
    );
    return genericError;
  }

  // 4. Verify password
  const passwordValid = await verifyPassword(password, user.password_hash);
  if (!passwordValid) {
    await query(
      `INSERT INTO login_attempt (username_attempted, success, ip_address)
       VALUES ($1, false, $2)`,
      [username, ipAddress ?? null]
    );
    return genericError;
  }

  // 5. Check if user is active
  if (user.status !== "ACTIVE") {
    return {
      success: false,
      statusCode: 403,
      error: { code: "ACCOUNT_INACTIVE", message: "Account is not active" },
    };
  }

  // 6. Success: record attempt, update last_login, create session in transaction
  return withTransaction(async (tx) => {
    await tx.query(
      `INSERT INTO login_attempt (username_attempted, success, ip_address)
       VALUES ($1, true, $2)`,
      [username, ipAddress ?? null]
    );

    await tx.query(`UPDATE app_user SET last_login = now() WHERE user_id = $1`, [
      user.user_id,
    ]);

    const { token, expiresAt } = await createSession(user.user_id, ipAddress, userAgent);

    return {
      success: true,
      statusCode: 200,
      user: {
        id: user.user_id,
        username: user.username,
        role: user.role_name,
      },
      sessionToken: token,
      sessionExpiresAt: expiresAt,
    };
  });
}

export async function logout(token: string): Promise<void> {
  await revokeSessionByToken(token);
}
