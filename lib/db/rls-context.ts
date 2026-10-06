import "server-only";
import type { PoolClient } from "./pool";

export interface RlsContext {
  userId: string;
  branchId: string | null;
  roleName: string;
}

/**
 * Sets transaction-local RLS/audit identity (app.current_*) on an open transaction client.
 * Transaction boundary: caller's; set_config(..., true) is discarded at COMMIT/ROLLBACK.
 * Uses parameterized set_config because SET LOCAL cannot take bind parameters.
 */
export async function setRlsContext(client: PoolClient, ctx: RlsContext): Promise<void> {
  await client.query(
    `SELECT set_config('app.current_user_id', $1, true),
            set_config('app.current_branch_id', $2, true),
            set_config('app.current_user_role', $3, true)`,
    [ctx.userId, ctx.branchId ?? "", ctx.roleName],
  );
}
