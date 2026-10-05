import { randomBytes, createHash } from "node:crypto";
import { createMigrationClient } from "../../lib/db/migration-client.mjs";
import { NextRequest } from "next/server";

export async function sessionFixture(roleName = "ADMIN") {
  const client = createMigrationClient(process.env.DATABASE_MIGRATION_URL);
  await client.connect();
  const username = `closeout_${randomBytes(5).toString("hex")}`;
  const { rows: roles } = await client.query("SELECT role_id FROM role WHERE role_name = $1", [roleName]);
  const { rows } = await client.query(
    "INSERT INTO app_user (role_id, username, password_hash) VALUES ($1, $2, $3) RETURNING user_id",
    [roles[0].role_id, username, "synthetic-test-only"],
  );
  const userId = rows[0].user_id;
  const token = randomBytes(32).toString("hex");
  const csrf = randomBytes(32).toString("hex");
  await client.query("INSERT INTO user_session (user_id, token_hash, expires_at) VALUES ($1, $2, now() + interval '1 hour')",
    [userId, createHash("sha256").update(token).digest("hex")]);
  return {
    client, userId, token, csrf,
    request(path, { method = "GET", body, authenticated = true, csrfToken = csrf, legacyCookie = false } = {}) {
      const headers = new Headers({ "Content-Type": "application/json" });
      if (authenticated) headers.set("cookie", `${legacyCookie ? "session" : "mims_session"}=${token}; mims_csrf=${csrfToken}`);
      if (csrfToken) headers.set("x-csrf-token", csrfToken);
      return new NextRequest(`http://localhost${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
    },
    async cleanup() {
      await client.query("DELETE FROM user_session WHERE user_id = $1", [userId]);
      await client.query("DELETE FROM app_user WHERE user_id = $1", [userId]);
      await client.end();
    },
  };
}
