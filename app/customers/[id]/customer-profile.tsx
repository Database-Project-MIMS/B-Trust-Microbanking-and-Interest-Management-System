"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { CustomerProfile as Profile } from "@/services/customer-service";
import { customerRequest, displayDate, displayMoney } from "../customer-client";
import { CustomerFixedDepositsPanel } from "./customer-fixed-deposits";

export function CustomerProfile({ id, canSearch }: { id: string; canSearch: boolean }) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController(); setProfile(null); setError("");
    customerRequest<Profile>(`/api/customers/${encodeURIComponent(id)}`, { signal: controller.signal }).then(profile => { if (!controller.signal.aborted) setProfile(profile); })
      .catch(error => { if (!controller.signal.aborted) setError(error instanceof Error ? error.message : "Unable to load customer."); });
    return () => controller.abort();
  }, [id, attempt]);
  return <>
    <div className="page-header"><div><p className="eyebrow">Customers</p><h1 className="page-title">Customer profile</h1></div>{canSearch && <Link className="btn btn-secondary" href="/customers">Back to search</Link>}</div>
    {error ? <div role="alert" className="card mt-6"><p>{error}</p><button className="btn btn-secondary" onClick={() => setAttempt(value => value + 1)}>Retry</button></div> : !profile ? <p role="status" className="mt-6">Loading customer…</p> : <>
      <section className="card mt-6"><h2>{profile.customer.fullName}</h2><dl>
        {Object.entries({ "Customer number": profile.customer.customerNumber, Identity: profile.customer.nicPassportNo, Email: profile.customer.email,
          "Date of birth": displayDate(profile.customer.dateOfBirth), Phone: profile.customer.phone ?? "—", Address: profile.customer.address ?? "—", Status: profile.customer.status }).map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}
      </dl></section>
      <section className="card mt-6"><h2>Assignment history</h2><div className="table-wrap mt-4"><table className="data-table"><thead><tr><th>Agent</th><th>Assigned</th><th>Ended</th><th>Status</th></tr></thead><tbody>
        {profile.assignmentHistory.map(row => <tr key={row.assignmentId}><td>{row.agentName}</td><td>{displayDate(row.assignedDate)}</td><td>{displayDate(row.endDate)}</td><td>{row.isActive ? "Current" : "Previous"}</td></tr>)}
        {!profile.assignmentHistory.length && <tr><td colSpan={4}>No assignment history.</td></tr>}
      </tbody></table></div></section>
      <section className="card mt-6"><h2>Documents</h2>{profile.documents.map(doc => <p key={doc.docId}>{doc.docType} · {doc.verifiedBy ? `Verified ${displayDate(doc.verifiedDate)}` : "Unverified"} · Uploaded {displayDate(doc.uploadedDate)}</p>)}{!profile.documents.length && <p>No documents recorded.</p>}</section>
      <section className="card mt-6"><h2>Savings accounts</h2>{profile.accounts === null ? <p>Account information is unavailable.</p> : profile.accounts.length ? <div className="table-wrap mt-4"><table className="data-table"><thead><tr><th>Account</th><th>Status</th><th>Balance</th></tr></thead><tbody>{profile.accounts.map(account => <tr key={account.accountId}><td><Link href={`/accounts/${account.accountId}`}>{account.accountNumber}</Link></td><td>{account.status}</td><td className="amount">{displayMoney(account.currentBalance)}</td></tr>)}</tbody></table></div> : <p>No linked accounts.</p>}</section>
      <CustomerFixedDepositsPanel key={profile.customer.customerId} customerId={profile.customer.customerId} />
    </>}
  </>;
}
