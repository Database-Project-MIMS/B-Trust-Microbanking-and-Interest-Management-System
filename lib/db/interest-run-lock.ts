import 'server-only';
import { withTransaction } from './with-transaction';
import { BusinessRuleError } from './errors';

/** A control-only transaction holds the lock; each distribution commits on its own connection. */
export async function withInterestRunLock<T>(operation: () => Promise<T>): Promise<T> {
  return withTransaction(async client => {
    // Transaction locks also work with Neon's PgBouncer transaction pooling and
    // release automatically on commit, rollback or a disconnected worker.
    const result = await client.query<{ locked: boolean }>(
      'SELECT pg_try_advisory_xact_lock($1::int,$2::int) AS locked', [3043, 5],
    );
    if (!result.rows[0]?.locked) {
      throw new BusinessRuleError('RUN_IN_PROGRESS', 'An interest run is already processing.');
    }
    return operation();
  }, { maxAttempts: 1 });
}
