"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import ReportShell from "@/components/report/report-shell";
import type { ReportColumn } from "@/components/report/report-table";
import type { ReportRequest } from "@/lib/report/report-handler";
import type { Rpt01Result, Rpt01Row } from "@/types/rpt01-report";

const endpoint = "/api/reports/agent-transactions";
const columns: ReportColumn<Rpt01Row>[] = [
  { key: "employeeNo", label: "Employee", kind: "text" },
  { key: "agentName", label: "Agent", kind: "text" },
  { key: "agentStatus", label: "Profile status", kind: "text" },
  { key: "branchName", label: "Posting branch", kind: "text" },
  { key: "transactionCount", label: "Count", kind: "count" },
  { key: "depositTotal", label: "Deposits", kind: "money" },
  { key: "withdrawalTotal", label: "Withdrawals", kind: "money" },
  { key: "interestTotal", label: "Interest", kind: "money" },
  { key: "reversalCredit", label: "Reversal credits", kind: "money" },
  { key: "reversalDebit", label: "Reversal debits", kind: "money" },
  { key: "unresolvedReversalCount", label: "Unlinked reversals", kind: "count" },
  { key: "netTotal", label: "Net movement", kind: "money" },
];

export function Rpt01Screen({ choices, today }: {
  choices: { branches: { id: string; name: string }[]; agents: { id: string; name: string }[]; branchId: string | null }; today: string;
}) {
  const initial: ReportRequest = { from: today, to: today, branchId: choices.branchId ?? undefined,
    format: "json", page: 1, pageSize: 25, sort: "employeeNo", direction: "asc" };
  const initialRef = useRef(initial);
  const [filters, setFilters] = useState(initial);
  const [result, setResult] = useState<Rpt01Result>();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const controller = useRef<AbortController | null>(null);
  const applied = useRef(initial);
  const load = useCallback(async (query: ReportRequest) => {
    controller.current?.abort();
    const active = new AbortController(); controller.current = active;
    setLoading(true); setError(""); setResult(undefined); applied.current = query;
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(query)) if (value !== undefined) params.set(key, String(value));
    try {
      const response = await fetch(endpoint + "?" + params.toString(), { signal: active.signal, cache: "no-store" });
      if (!response.ok) throw new Error("The report could not be loaded. Check your filters and access, then retry.");
      const body = await response.json() as { data: Rpt01Result };
      if (!active.signal.aborted) setResult(body.data);
    } catch (failure) {
      if (!active.signal.aborted) setError(failure instanceof Error ? failure.message : "The report is unavailable.");
    } finally { if (!active.signal.aborted) setLoading(false); }
  }, []);
  useEffect(() => { void load(initialRef.current); return () => controller.current?.abort(); }, [load]);
  const scope = result?.filters.branchId
    ? choices.branches.find(branch => branch.id === result.filters.branchId)?.name ?? "Selected posting branch"
    : "Bankwide · all posting branches";
  const agentLabel = result?.filters.agentId
    ? choices.agents.find(agent => agent.id === result.filters.agentId)?.name ?? "Selected historical agent"
    : "All eligible agents";
  return <div className="space-y-6 min-w-0">
    <ReportShell title="Agent-wise transactions" reportCode="RPT-01" filters={filters} onFilterChange={setFilters}
      onApply={() => { void load({ ...filters, page: 1 }); }} result={result} loading={loading}
      endpoint={endpoint} branches={choices.branches} agents={choices.agents} branchLocked={choices.branchId !== null}
      columns={columns} rowKey={row => row.agentId + ":" + (row.branchId ?? "null")} scopeLabel={scope} agentLabel={agentLabel}
      filterExtras={<>
        <label className="field">Sort by<select className="input" value={filters.sort}
          onChange={event => setFilters({ ...filters, sort: event.target.value })}>
          <option value="employeeNo">Employee number</option><option value="agentName">Agent name</option><option value="netTotal">Net movement</option>
        </select></label>
        <label className="field">Order<select className="input" value={filters.direction}
          onChange={event => setFilters({ ...filters, direction: event.target.value as "asc" | "desc" })}>
          <option value="asc">Ascending</option><option value="desc">Descending</option>
        </select></label>
        <label className="field">Rows per page<select className="input" value={filters.pageSize}
          onChange={event => setFilters({ ...filters, pageSize: Number(event.target.value) })}>
          {[25, 50, 100].map(size => <option key={size} value={size}>{size}</option>)}
        </select></label>
      </>}>
      {error && <div className="card text-[var(--danger)]" role="alert">{error}
        <button type="button" className="btn btn-secondary mt-4" onClick={() => { void load(applied.current); }}>Retry report</button>
      </div>}
    </ReportShell>
    {result && <section className="card space-y-4">
      <nav aria-label="Report pagination" className="flex flex-wrap items-center gap-4">
        <button type="button" className="btn btn-secondary" disabled={result.page <= 1 || loading}
          onClick={() => { void load({ ...result.filters, page: result.page - 1 }); }}>Previous</button>
        <span role="status">Page {result.page} of {Math.max(1, Math.ceil(result.totalRows / result.pageSize))} · {result.totalRows} agent/branch rows</span>
        <button type="button" className="btn btn-secondary" disabled={result.page * result.pageSize >= result.totalRows || loading}
          onClick={() => { void load({ ...result.filters, page: result.page + 1 }); }}>Next</button>
      </nav>
      <p>Excluded unattributed transactions in this branch/date scope: {result.exclusions.transactionCount}.
        Their unsigned value is {result.exclusions.unsignedValue} LKR.</p>
      <ul className="space-y-2 text-sm text-[var(--text-muted)]">{result.notes.map(note => <li key={note}>{note}</li>)}</ul>
      {choices.agents.length === 1000 && <p className="muted">The agent picker shows the first 1,000 profiles. The report includes all eligible agents.</p>}
    </section>}
  </div>;
}
