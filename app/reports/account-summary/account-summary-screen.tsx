"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import ReportShell from "@/components/report/report-shell";
import type { ReportColumn } from "@/components/report/report-table";
import type { ReportRequest } from "@/lib/report/report-handler";
import type { AccountSummaryChoices, AccountSummaryResult, AccountSummaryRow } from "@/types/account-summary-report";

const endpoint = "/api/reports/account-summary";
const sortLabels: Record<string, string> = {
  accountNumber: "Account number", openingBalance: "Opening balance", closingBalance: "Closing balance", netMovement: "Net movement",
};
// The first column is the row header; money and count columns line up with the keys in the totals rows.
const columns: ReportColumn<AccountSummaryRow>[] = [
  { key: "accountNumber", label: "Account", kind: "text" },
  { key: "branchName", label: "Branch", kind: "text" },
  { key: "planName", label: "Plan", kind: "text" },
  { key: "accountStatus", label: "Status", kind: "text" },
  { key: "openingBalance", label: "Opening balance", kind: "money" },
  { key: "depositCount", label: "Deposits (count)", kind: "count" },
  { key: "depositTotal", label: "Deposits", kind: "money" },
  { key: "withdrawalCount", label: "Withdrawals (count)", kind: "count" },
  { key: "withdrawalTotal", label: "Withdrawals", kind: "money" },
  { key: "interestCount", label: "Interest (count)", kind: "count" },
  { key: "interestTotal", label: "Interest", kind: "money" },
  { key: "reversalCount", label: "Reversals (count)", kind: "count" },
  { key: "closingBalance", label: "Closing balance", kind: "money" },
  { key: "netMovement", label: "Net movement", kind: "money" },
];

export function AccountSummaryScreen({ choices, today }: { choices: AccountSummaryChoices; today: string }) {
  const initial: ReportRequest = { from: today, to: today, branchId: choices.branchId ?? undefined,
    format: "json", page: 1, pageSize: 25, sort: "accountNumber", direction: "asc" };
  const initialRef = useRef(initial);
  const [filters, setFilters] = useState(initial);
  const [result, setResult] = useState<AccountSummaryResult>();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const controller = useRef<AbortController | null>(null);
  const applied = useRef(initial);
  const load = useCallback(async (query: ReportRequest) => {
    controller.current?.abort();
    const active = new AbortController(); controller.current = active;
    setLoading(true); setError(""); setResult(undefined); applied.current = query;
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(query)) if (value !== undefined && value !== "") params.set(key, String(value));
    try {
      const response = await fetch(endpoint + "?" + params.toString(), { signal: active.signal, cache: "no-store" });
      if (!response.ok) throw new Error("The report could not be loaded. Check your filters and access, then retry.");
      const body = await response.json() as { data: AccountSummaryResult };
      if (!active.signal.aborted) setResult(body.data);
    } catch (failure) {
      if (!active.signal.aborted) setError(failure instanceof Error ? failure.message : "The report is unavailable.");
    } finally { if (!active.signal.aborted) setLoading(false); }
  }, []);
  useEffect(() => { void load(initialRef.current); return () => controller.current?.abort(); }, [load]);
  const scope = result?.filters.branchId
    ? choices.branches.find(branch => branch.id === result.filters.branchId)?.name ?? "Selected branch"
    : "Bankwide · all branches";
  const pages = result ? Math.max(1, Math.ceil(result.totalRows / result.pageSize)) : 1;
  return <div className="space-y-6 min-w-0">
    <ReportShell title="Account summary" reportCode="RPT-02" filters={filters} onFilterChange={setFilters}
      onApply={() => { void load({ ...filters, page: 1 }); }} result={result} loading={loading}
      endpoint={endpoint} columns={columns} rowKey={row => row.accountId} scopeLabel={scope} sortLabels={sortLabels}
      caption="Account summary: page details, page subtotal and full-filter grand total"
      emptyText="No accounts match these filters. Grand totals still cover all applied filters."
      filterExtras={<>
        <label className="field">Branch<select className="input" disabled={choices.branchId !== null} value={filters.branchId ?? ""}
          onChange={event => setFilters({ ...filters, branchId: event.target.value || undefined })}>
          {choices.branchId === null && <option value="">All branches</option>}
          {choices.branches.map(branch => <option key={branch.id} value={branch.id}>{branch.name}</option>)}
        </select></label>
        <label className="field">Savings plan<select className="input" value={filters.planId ?? ""}
          onChange={event => setFilters({ ...filters, planId: event.target.value || undefined })}>
          <option value="">All plans</option>
          {choices.plans.map(plan => <option key={plan.id} value={plan.id}>{plan.name}</option>)}
        </select></label>
        <label className="field">Account status<select className="input" value={filters.status ?? ""}
          onChange={event => setFilters({ ...filters, status: event.target.value || undefined })}>
          <option value="">All statuses</option><option value="ACTIVE">Active</option>
          <option value="FROZEN">Frozen</option><option value="CLOSED">Closed</option>
        </select></label>
        <label className="field">Sort by<select className="input" value={filters.sort}
          onChange={event => setFilters({ ...filters, sort: event.target.value })}>
          {Object.entries(sortLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
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
        <span role="status">Page {result.page} of {pages} · {result.totalRows} accounts</span>
        <button type="button" className="btn btn-secondary" disabled={result.page >= pages || loading}
          onClick={() => { void load({ ...result.filters, page: result.page + 1 }); }}>Next</button>
      </nav>
      <ul className="space-y-2 text-sm text-[var(--text-muted)]">{result.notes.map(note => <li key={note}>{note}</li>)}</ul>
    </section>}
  </div>;
}
