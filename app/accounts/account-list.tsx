"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { AccountSearchResult } from "@/services/account-service";
import { accountRequest } from "./account-client";
import { displayDate, displayMoney } from "./account-format";

export function AccountList({ canOpen, plans }: { canOpen: boolean; plans: { id: string; name: string }[] }) {
  const [query, setQuery] = useState("page=1");
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<AccountSearchResult | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError(""); setResult(null);
    accountRequest<AccountSearchResult>(`/api/accounts?${query}`, { signal: controller.signal })
      .then(response => {
        if (controller.signal.aborted) return;
        if (response.ok && response.data) setResult(response.data); else setError(response.error?.message ?? "Unable to load accounts.");
      })
      .catch(() => { /* aborted by a newer search */ })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [query, attempt]);

  function changePage(page: number) { const params = new URLSearchParams(query); params.set("page", String(page)); setQuery(params.toString()); }

  return <>
    <div className="page-header"><div><p className="eyebrow">Savings accounts</p><h1 className="page-title">Accounts</h1></div>
      {canOpen && <Link className="btn btn-primary" href="/accounts/new">Open account</Link>}</div>
    <form className="card form-grid mt-6" onSubmit={event => {
      event.preventDefault(); const params = new URLSearchParams();
      for (const [name, value] of new FormData(event.currentTarget)) { if (String(value).trim()) params.set(name, String(value).trim()); }
      params.set("page", "1"); setQuery(params.toString()); setAttempt(value => value + 1);
    }}>
      <div className="two-col">
        <label className="field">Account number, holder name or customer number<input className="input" name="q" maxLength={100} /></label>
        <label className="field">Status<select className="input" name="status"><option value="">All statuses</option><option>ACTIVE</option><option>FROZEN</option><option>CLOSED</option></select></label>
        <label className="field">Savings plan<select className="input" name="planId"><option value="">All plans</option>{plans.map(plan => <option key={plan.id} value={plan.id}>{plan.name}</option>)}</select></label>
        <label className="field">Sort by<select className="input" name="sortBy"><option value="accountNumber">Account number</option><option value="openedDate">Opened date</option><option value="currentBalance">Balance</option><option value="status">Status</option></select></label>
        <label className="field">Direction<select className="input" name="sortDirection"><option value="asc">Ascending</option><option value="desc">Descending</option></select></label>
      </div>
      <button className="btn btn-primary" type="submit" disabled={loading}>Search accounts</button>
    </form>
    {error && <div role="alert" className="mt-6"><p className="text-[var(--danger)]">{error}</p><button className="btn btn-secondary" onClick={() => setAttempt(value => value + 1)}>Retry search</button></div>}
    <section aria-busy={loading} aria-label="Account results" className="card mt-6">
      <p role="status">{loading ? "Loading accounts…" : result ? `${result.total} account${result.total === 1 ? "" : "s"} found` : "Search unavailable."}</p>
      {result && <>
        <div className="table-wrap mt-4"><table className="data-table"><thead><tr><th>Account</th><th>Primary holder</th><th>Plan</th><th>Opened</th><th className="amount">Balance</th><th>Status</th></tr></thead><tbody>
          {result.accounts.map(account => <tr key={account.accountId}>
            <td><Link href={`/accounts/${account.accountId}`}>{account.accountNumber}</Link></td>
            <td>{account.primaryHolderName ?? "—"}{account.holderCount > 1 ? ` + ${account.holderCount - 1} joint` : ""}</td>
            <td>{account.planName}</td><td>{displayDate(account.openedDate)}</td>
            <td className="amount">{displayMoney(account.currentBalance)}</td><td><span className="status-pill">{account.status}</span></td></tr>)}
          {!result.accounts.length && <tr><td colSpan={6}>No accounts match your search.</td></tr>}
        </tbody></table></div>
        <div className="flex items-center gap-4 mt-6"><button className="btn btn-secondary" disabled={result.page === 1} onClick={() => changePage(result.page - 1)}>Previous</button>
          <span>Page {result.page}</span><button className="btn btn-secondary" disabled={result.page * result.pageSize >= result.total} onClick={() => changePage(result.page + 1)}>Next</button></div>
      </>}
    </section>
  </>;
}
