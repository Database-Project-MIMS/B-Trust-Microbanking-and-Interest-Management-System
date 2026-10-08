"use client";

import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { displayMoney } from "@/app/accounts/account-format";
import { colomboToday } from "@/lib/validation/agent-activity";
import type { AgentActivity, AgentActivityType } from "@/types/agent-activity";

const labels: Record<AgentActivityType, string> = {
  DEPOSIT: "Deposits", WITHDRAWAL: "Withdrawals", INTEREST_CREDIT: "Interest credits", REVERSAL: "Reversals",
};

/** Displays live type totals; stale totals are hidden while a different period is loading. */
export function AgentActivityScreen({ agentId, today, backHref }: { agentId: string; today: string; backHref: string }) {
  const router = useRouter();
  const [from, setFrom] = useState(today);
  const [to, setTo] = useState(today);
  const [range, setRange] = useState({ from: today, to: today });
  const [version, setVersion] = useState(0);
  const [activity, setActivity] = useState<AgentActivity | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    setLoading(true);
    setError(null);
    setActivity(null);
    async function load() {
      try {
        const query = new URLSearchParams(range);
        const response = await fetch(`/api/agents/${encodeURIComponent(agentId)}/activity?${query}`, {
          cache: "no-store", signal: controller.signal,
        });
        if (response.status === 401) {
          if (active) router.replace(`/sign-in?next=${encodeURIComponent(`/agents/${agentId}/activity`)}`);
          return;
        }
        const body = await response.json() as { data?: AgentActivity; error?: { message?: string } };
        if (!response.ok || !body.data) throw new Error(body.error?.message ?? "Activity could not be loaded.");
        if (active) setActivity(body.data);
      } catch (caught: unknown) {
        if (active) setError(caught instanceof Error ? caught.message : "Activity could not be loaded.");
      } finally {
        if (active) setLoading(false);
      }
    }
    void load();
    return () => { active = false; controller.abort(); };
  }, [agentId, range, version, router]);

  function applyRange(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setRange({ from, to });
  }

  return <div className="space-y-6">
    <Link className="text-sm text-[var(--primary)] underline" href={backHref}>Back to {backHref === "/agents" ? "agents" : "customers"}</Link>
    <div className="page-header"><div><p className="eyebrow">Agent activity</p>
      <h1 className="page-title">Daily activity</h1>
      <p className="page-description">Transaction counts and amounts by type. Dates use Sri Lanka time (Asia/Colombo).</p>
    </div></div>
    <form className="card" onSubmit={applyRange}>
      <div className="two-col">
        <label className="field" htmlFor="activity-from">From (required)
          <input className="input" id="activity-from" type="date" required value={from} max={to || undefined}
            disabled={loading} onChange={event => setFrom(event.target.value)} /></label>
        <label className="field" htmlFor="activity-to">To (required)
          <input className="input" id="activity-to" type="date" required value={to} min={from || undefined}
            disabled={loading} onChange={event => setTo(event.target.value)} /></label>
      </div>
      <div className="mt-6 flex flex-wrap gap-3">
        <button className="btn btn-primary" disabled={loading} type="submit">{loading ? "Loading…" : "Show activity"}</button>
        <button className="btn btn-secondary" disabled={loading} type="button" onClick={() => {
          const current = colomboToday();
          setFrom(current); setTo(current); setRange({ from: current, to: current });
        }}>Today</button>
      </div>
    </form>
    {loading && <p role="status">Loading agent activity…</p>}
    {error && <div className="card"><p className="text-[var(--danger)]" role="alert">{error}</p>
      <button className="btn btn-secondary mt-4" type="button" onClick={() => setVersion(value => value + 1)}>Retry</button></div>}
    {activity && <section className="card space-y-6" aria-label="Activity results" aria-live="polite">
      <div><h2 className="section-heading">{activity.agent.fullName} · {activity.agent.employeeNo}</h2>
        <p className="muted">Current branch: {activity.agent.branchCode} — {activity.agent.branchName}</p>
        <p className="mt-2 text-sm">{activity.from} to {activity.to}, inclusive · LKR</p>
      </div>
      <p className="workflow-notice">{activity.scope === "BRANCH"
        ? "Only this agent’s transactions recorded at your branch are included."
        : "Only transactions attributed to this agent are included, across their posting branches."}
        {" "}These are amounts by type, not an account balance. Transactions without agent attribution are excluded.</p>
      {activity.byType.length === 0 ? <p role="status">No attributed transactions in this date range.</p>
        : <div className="table-wrap"><table className="data-table">
          <caption className="sr-only">Activity by transaction type for {activity.from} to {activity.to}</caption>
          <thead><tr><th scope="col">Transaction type</th><th scope="col" style={{ textAlign: "right" }}>Count</th>
            <th scope="col" style={{ textAlign: "right" }}>Total amount (LKR)</th></tr></thead>
          <tbody>{activity.byType.map(row => <tr key={row.type}>
            <th scope="row">{labels[row.type]}</th><td className="tabular-nums" style={{ textAlign: "right" }}>{row.count}</td>
            <td className="amount" style={{ textAlign: "right" }}>{displayMoney(row.total)}</td>
          </tr>)}</tbody>
        </table></div>}
    </section>}
  </div>;
}
