import "server-only";
import { getPoolMetrics, queryOne } from "@/lib/db";
import type { AuthenticatedUser } from "@/lib/auth/rbac";

export const HEALTH_DETAIL_ROLES = ["ADMIN", "CENTRAL_OPS"] as const;

export interface HealthStatus {
  status: "ok" | "degraded";
  db?: { connected: boolean; poolTotal: number; poolIdle: number; poolWaiting: number };
  migrationsApplied?: number;
  lastMigration?: string | null;
  uptimeSeconds?: number;
}

/** Read-only health queries outside a write transaction; detail follows validated role. */
export async function getHealthStatus(user: AuthenticatedUser): Promise<HealthStatus> {
  const connected = (await queryOne<{ ok: number }>("SELECT 1 AS ok", [], "health.connection"))?.ok === 1;
  const status = connected ? "ok" : "degraded";
  if (!HEALTH_DETAIL_ROLES.some((role) => role === user.roleName)) return { status };
  const migration = await queryOne<{ count: number; last: string | null }>(
    "SELECT count(*)::int AS count, max(filename) AS last FROM schema_migration",
    [], "health.migrations",
  );
  const metrics = getPoolMetrics();
  return {
    status,
    db: { connected, poolTotal: metrics.totalCount, poolIdle: metrics.idleCount, poolWaiting: metrics.waitingCount },
    migrationsApplied: migration?.count ?? 0,
    lastMigration: migration?.last ?? null,
    uptimeSeconds: Math.floor(process.uptime()),
  };
}
