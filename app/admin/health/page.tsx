import { queryOne } from "@/lib/db";

export default async function HealthPage() {
  // Dynamic fallbacks until Task 1 and Auth are merged
  let metrics = { totalCount: 0, idleCount: 0, waitingCount: 0 };
  try {
    const db = require("@/lib/db");
    if (db.getPoolMetrics) metrics = db.getPoolMetrics();
    const auth = require("@/lib/auth");
    if (auth.requireRole) await auth.requireRole(["ADMIN", "CENTRAL_OPS"]);
  } catch {}

  const lastMig = await queryOne<{ filename: string }>("SELECT filename FROM schema_migration ORDER BY filename DESC LIMIT 1");

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-4">Database Health</h1>
      <div className="grid grid-cols-2 gap-4 max-w-md">
        <div className="p-4 border rounded shadow">
          <h2 className="font-semibold text-lg border-b pb-2 mb-2">Pool Status</h2>
          <p>Total Connections: {metrics.totalCount}</p>
          <p>Idle Connections: {metrics.idleCount}</p>
          <p>Waiting Requests: {metrics.waitingCount}</p>
        </div>
        <div className="p-4 border rounded shadow">
          <h2 className="font-semibold text-lg border-b pb-2 mb-2">Last Migration</h2>
          <p className="text-sm font-mono">{lastMig?.filename || "None"}</p>
        </div>
      </div>
    </div>
  );
}