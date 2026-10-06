import { requirePageRole } from "@/lib/auth/page-access";
import { getHealthStatus, HEALTH_DETAIL_ROLES } from "@/services/health-service";

export const dynamic = "force-dynamic";

export default async function HealthPage() {
  const session = await requirePageRole(...HEALTH_DETAIL_ROLES);
  let health;
  try {
    health = await getHealthStatus(session);
  } catch {
    return <div className="card" role="alert">Database health is temporarily unavailable.</div>;
  }
  return (
    <>
      <div className="page-header">
        <div><p className="eyebrow">Administration</p><h1 className="page-title">Database health</h1>
          <p className="page-description">Current connection, pool and migration status.</p></div>
      </div>
      <div className="mt-6 grid gap-6 sm:grid-cols-2">
        <section className="card">
          <h2 className="section-heading">Connection and pool</h2>
          <dl className="mt-4 space-y-2">
            <div><dt className="text-[var(--text-muted)]">Connection</dt><dd>{health.db?.connected ? "Connected" : "Unavailable"}</dd></div>
            <div><dt className="text-[var(--text-muted)]">Total connections</dt><dd>{health.db?.poolTotal}</dd></div>
            <div><dt className="text-[var(--text-muted)]">Idle connections</dt><dd>{health.db?.poolIdle}</dd></div>
            <div><dt className="text-[var(--text-muted)]">Waiting requests</dt><dd>{health.db?.poolWaiting}</dd></div>
          </dl>
        </section>
        <section className="card">
          <h2 className="section-heading">Migrations and uptime</h2>
          <dl className="mt-4 space-y-2">
            <div><dt className="text-[var(--text-muted)]">Applied migrations</dt><dd>{health.migrationsApplied}</dd></div>
            <div><dt className="text-[var(--text-muted)]">Last migration</dt><dd className="break-all font-mono text-sm">{health.lastMigration ?? "None"}</dd></div>
            <div><dt className="text-[var(--text-muted)]">Process uptime</dt><dd>{health.uptimeSeconds} seconds</dd></div>
          </dl>
        </section>
      </div>
    </>
  );
}
