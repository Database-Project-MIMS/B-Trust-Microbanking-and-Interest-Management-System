"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { CustomerSearchResult } from "@/services/customer-service";
import { customerRequest } from "./customer-client";

export function CustomerList({ canRegister, branches, agents }: {
  canRegister: boolean; branches: { id: string; name: string }[]; agents: { id: string; name: string }[];
}) {
  const [query, setQuery] = useState("page=1");
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<CustomerSearchResult | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError(""); setResult(null);
    customerRequest<CustomerSearchResult>(`/api/customers?${query}`, { signal: controller.signal })
      .then(result => { if (!controller.signal.aborted) setResult(result); }).catch(error => { if (!controller.signal.aborted) setError(error instanceof Error ? error.message : "Unable to load customers."); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [query, attempt]);
  function changePage(page: number) { const params = new URLSearchParams(query); params.set("page", String(page)); setQuery(params.toString()); }
  return <>
    <div className="page-header"><div><p className="eyebrow">Customers</p><h1 className="page-title">Customer search</h1></div>
      {canRegister && <Link className="btn btn-primary" href="/customers/new">Register customer</Link>}</div>
    <form className="card form-grid mt-6" onSubmit={event => {
      event.preventDefault(); const params = new URLSearchParams();
      for (const [key, value] of new FormData(event.currentTarget)) { if (String(value).trim()) params.set(key, String(value).trim()); }
      params.set("page", "1"); setQuery(params.toString()); setAttempt(value => value + 1);
    }}>
      <div className="two-col">
        <label className="field">Name, customer number or identity<input className="input" name="q" maxLength={150} /></label>
        <label className="field">Status<select className="input" name="status"><option value="">All statuses</option><option>ACTIVE</option><option>INACTIVE</option></select></label>
        <label className="field">Branch<select className="input" name="branchId"><option value="">All permitted branches</option>{branches.map(branch => <option key={branch.id} value={branch.id}>{branch.name}</option>)}</select></label>
        <label className="field">Assigned agent<select className="input" name="agentId"><option value="">All permitted agents</option>{agents.map(agent => <option key={agent.id} value={agent.id}>{agent.name}</option>)}</select></label>
        <label className="field">Sort by<select className="input" name="sortBy"><option value="fullName">Name</option><option value="customerNumber">Customer number</option><option value="createdAt">Registration date</option></select></label>
        <label className="field">Direction<select className="input" name="sortDirection"><option value="asc">Ascending</option><option value="desc">Descending</option></select></label>
      </div><button className="btn btn-primary" type="submit" disabled={loading}>Search customers</button>
    </form>
    {error && <div role="alert" className="mt-6"><p className="text-[var(--danger)]">{error}</p><button className="btn btn-secondary" onClick={() => setAttempt(value => value + 1)}>Retry search</button></div>}
    <section aria-busy={loading} aria-label="Customer results" className="card mt-6">
      <p role="status">{loading ? "Loading customers…" : result ? `${result.total} customers found` : "Search unavailable."}</p>
      {result && <><div className="table-wrap mt-4"><table className="data-table"><thead><tr><th>Name</th><th>Customer number</th><th>Identity</th><th>Email</th><th>Status</th></tr></thead><tbody>
        {result.customers.map(customer => <tr key={customer.customerId}><td><Link href={`/customers/${customer.customerId}`}>{customer.fullName}</Link></td><td>{customer.customerNumber}</td><td>{customer.nicPassportNo}</td><td>{customer.email}</td><td><span className="status-pill">{customer.status}</span></td></tr>)}
        {!result.customers.length && <tr><td colSpan={5}>No customers match your search.</td></tr>}
      </tbody></table></div><div className="flex items-center gap-4 mt-6"><button className="btn btn-secondary" disabled={result.page === 1} onClick={() => changePage(result.page - 1)}>Previous</button>
        <span>Page {result.page}</span><button className="btn btn-secondary" disabled={result.page * result.pageSize >= result.total} onClick={() => changePage(result.page + 1)}>Next</button></div></>}
    </section>
  </>;
}
