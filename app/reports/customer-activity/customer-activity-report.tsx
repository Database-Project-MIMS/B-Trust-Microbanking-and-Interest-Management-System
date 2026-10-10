'use client';

import { useEffect, useState } from 'react';
import type { ReportRequest, ReportResult } from '@/lib/report/report-handler';
import type { CustomerActivityRow } from '@/services/customer-activity-report-service';

type Result = ReportResult<CustomerActivityRow>;
const INITIAL: ReportRequest = { format: 'json', page: 1, pageSize: 25 };

function queryString(filters: ReportRequest, format: 'json' | 'csv'): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries({ ...filters, format })) {
    if (value !== undefined && value !== '') params.set(key, String(value));
  }
  return params.toString();
}

function money(value: string | undefined): string {
  if (!value || !/^-?\d+\.\d{2}$/.test(value)) return '—';
  const negative = value.startsWith('-');
  const [whole = '0', cents = '00'] = (negative ? value.slice(1) : value).split('.');
  return `${negative ? '−' : ''}LKR ${whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}.${cents}`;
}

export function CustomerActivityReport() {
  const [filters, setFilters] = useState<ReportRequest>(INITIAL);
  const [applied, setApplied] = useState<ReportRequest>(INITIAL);
  const [result, setResult] = useState<Result | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    fetch(`/api/reports/customer-activity?${queryString(applied, 'json')}`, {
      signal: controller.signal,
    }).then(async (response) => {
      const body = await response.json();
      if (!response.ok) throw new Error(body.error?.message ?? 'Could not load the report.');
      return body.data as Result;
    }).then((data) => {
      setResult(data);
      setLoading(false);
    }).catch((cause: unknown) => {
      if (controller.signal.aborted) return;
      setError(cause instanceof Error ? cause.message : 'Could not load the report.');
      setLoading(false);
    });
    return () => controller.abort();
  }, [applied]);

  const apply = () => setApplied({ ...filters, page: 1 });
  const goToPage = (page: number) => {
    const next = { ...applied, page };
    setFilters(next);
    setApplied(next);
  };

  return <div className="space-y-6">
    <div className="page-header">
      <div>
        <p className="eyebrow">Reports</p>
        <h1 className="page-title">Customer activity</h1>
        <p className="page-description">Deposits, withdrawals, interest and net movement by customer. Joint account activity appears for every holder.</p>
      </div>
    </div>

    <div className="card">
      <div className="form-grid">
        <label className="field">From date
          <input className="input" type="date" value={filters.from ?? ''} onChange={event => setFilters({ ...filters, from: event.target.value })} />
        </label>
        <label className="field">To date
          <input className="input" type="date" value={filters.to ?? ''} onChange={event => setFilters({ ...filters, to: event.target.value })} />
        </label>
        <label className="field">Branch ID
          <input className="input" value={filters.branchId ?? ''} onChange={event => setFilters({ ...filters, branchId: event.target.value })} />
        </label>
        <label className="field">Account ID
          <input className="input" value={filters.accountId ?? ''} onChange={event => setFilters({ ...filters, accountId: event.target.value })} />
        </label>
        <label className="field">Plan ID
          <input className="input" value={filters.planId ?? ''} onChange={event => setFilters({ ...filters, planId: event.target.value })} />
        </label>
        <label className="field">Account status
          <select className="input" value={filters.status ?? ''} onChange={event => setFilters({ ...filters, status: event.target.value })}>
            <option value="">All statuses</option>
            <option value="ACTIVE">Active</option>
            <option value="FROZEN">Frozen</option>
            <option value="CLOSED">Closed</option>
          </select>
        </label>
      </div>
      <div className="mt-6 flex flex-wrap gap-3">
        <button className="btn btn-primary" type="button" onClick={apply} disabled={loading}>Apply filters</button>
        {result && <a className="btn btn-secondary" href={`/api/reports/customer-activity?${queryString(applied, 'csv')}`}>Export CSV</a>}
      </div>
    </div>

    {error && <div className="card text-[var(--danger)]" role="alert">{error} <button className="btn btn-secondary" type="button" onClick={() => setApplied({ ...applied })}>Retry</button></div>}
    {loading && <p className="muted" role="status">Loading report…</p>}
    {!loading && result && <>
      <div className="card">
        <p className="muted">Generated {new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Colombo', dateStyle: 'medium', timeStyle: 'short' }).format(new Date(result.generatedAt))} · Requested by {result.requestedBy}</p>
        <p className="muted">Applied filters: {result.filters.from ?? 'Any date'} to {result.filters.to ?? 'Any date'} · Branch {result.filters.branchId ?? 'All'} · Account {result.filters.accountId ?? 'All'} · Plan {result.filters.planId ?? 'All'} · Status {result.filters.status ?? 'All'}</p>
        <p className="muted">Showing {result.rows.length} of {result.totalRows} customers. Totals count joint activity once per holder.</p>
      </div>
      <div className="card">
        <div className="table-wrap">
          <table className="data-table">
            <thead><tr>
              <th>Customer</th><th>Accounts</th><th className="text-right">Deposits</th><th className="text-right">Withdrawals</th><th className="text-right">Interest</th><th className="text-right">Net</th>
            </tr></thead>
            <tbody>
              {result.rows.length === 0 && <tr><td colSpan={6}>No customers match these filters.</td></tr>}
              {result.rows.map(row => <tr key={row.customer_id}>
                <td>{row.full_name}</td><td>{row.account_count}</td>
                <td className="amount">{money(row.deposits)}</td>
                <td className="amount">{money(row.withdrawals)}</td>
                <td className="amount">{money(row.interest)}</td>
                <td className="amount">{money(row.net)}</td>
              </tr>)}
              {result.subtotals && <tr><th colSpan={2}>Page subtotal</th>
                <td className="amount">{money(result.subtotals.deposits)}</td>
                <td className="amount">{money(result.subtotals.withdrawals)}</td>
                <td className="amount">{money(result.subtotals.interest)}</td>
                <td className="amount">{money(result.subtotals.net)}</td>
              </tr>}
              {result.grandTotal && <tr><th colSpan={2}>Grand total</th>
                <td className="amount">{money(result.grandTotal.deposits)}</td>
                <td className="amount">{money(result.grandTotal.withdrawals)}</td>
                <td className="amount">{money(result.grandTotal.interest)}</td>
                <td className="amount">{money(result.grandTotal.net)}</td>
              </tr>}
            </tbody>
          </table>
        </div>
        <div className="mt-6 flex items-center gap-3">
          <button className="btn btn-secondary" type="button" disabled={loading || (applied.page ?? 1) <= 1} onClick={() => goToPage((applied.page ?? 1) - 1)}>Previous</button>
          <span className="muted">Page {applied.page ?? 1}</span>
          <button className="btn btn-secondary" type="button" disabled={loading || (applied.page ?? 1) * (applied.pageSize ?? 25) >= result.totalRows} onClick={() => goToPage((applied.page ?? 1) + 1)}>Next</button>
        </div>
      </div>
    </>}
  </div>;
}
