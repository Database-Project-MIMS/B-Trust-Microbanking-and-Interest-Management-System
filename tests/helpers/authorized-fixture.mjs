import { createFixture, requireDisposableDatabase } from './customer-registration.mjs';
import { createSession } from '../../lib/auth/session.ts';

/** Creates committed API fixtures with explicit RLS context in the disposable DB. */
export async function authorizedFixture(client) {
  await requireDisposableDatabase(client);
  await client.query('BEGIN');
  try {
    await client.query("SELECT set_config('app.current_user_role', 'ADMIN', true)");
    const fixture = await createFixture(client);
    await client.query('COMMIT');
    return fixture;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  }
}

/** Uses the production token hash and DB-generated UUID session identity. */
export async function fixtureSession(client, userId) {
  return (await createSession(userId, undefined, undefined, client)).token;
}
