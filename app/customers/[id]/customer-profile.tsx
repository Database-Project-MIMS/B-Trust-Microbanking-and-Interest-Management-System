"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { CustomerProfile as Profile } from "@/services/customer-service";
import { customerRequest, displayDate, displayMoney } from "../customer-client";
import { CustomerFixedDepositsPanel } from "./customer-fixed-deposits";
import { accountRequest, csrfToken } from '@/app/accounts/account-client';

export function CustomerProfile({ id, canSearch, canVerify = false }: { id: string; canSearch: boolean; canVerify?: boolean }) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const [verifying, setVerifying] = useState<string | null>(null);
  const [verifyError, setVerifyError] = useState('');
  const [confirmDoc, setConfirmDoc] = useState<string | null>(null);
  async function verify(docId: string) {
    setVerifying(docId); setVerifyError('');
    const response=await accountRequest(`/api/customer-documents/${encodeURIComponent(docId)}/verify`,
      {method:'POST',headers:{'x-csrf-token':csrfToken()}});
    setVerifying(null);
    if(response.ok){setConfirmDoc(null);setAttempt(value=>value+1);}
    else setVerifyError(response.error?.message ?? 'Unable to verify document.');
  }
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
      <section className="card mt-6 space-y-4"><h2>Documents</h2>{profile.documents.map(doc => <div key={doc.docId}><p>{doc.docType} · {doc.verifiedBy ? `Verified ${displayDate(doc.verifiedDate)}` : "Unverified"} · Uploaded {displayDate(doc.uploadedDate)}</p>
        {canVerify && !doc.verifiedBy && (confirmDoc===doc.docId ? <div className="confirmation-card"><p>Confirm you have checked this customer's {doc.docType} document.</p>
          <button className="btn btn-primary" disabled={verifying!==null} onClick={()=>void verify(doc.docId)}>{verifying?'Verifying…':'Confirm verification'}</button>
          <button className="btn btn-secondary" disabled={verifying!==null} onClick={()=>setConfirmDoc(null)}>Cancel</button></div> :
          <button className="btn btn-secondary" onClick={()=>setConfirmDoc(doc.docId)}>Verify document</button>)}</div>)}
        {verifyError && <p role="alert">{verifyError}</p>}{!profile.documents.length && <p>No documents recorded.</p>}</section>
      <section className="card mt-6"><h2>Savings accounts</h2>{profile.accounts === null ? <p>Account information is unavailable.</p> : profile.accounts.length ? <div className="table-wrap mt-4"><table className="data-table"><thead><tr><th>Account</th><th>Status</th><th>Balance</th></tr></thead><tbody>{profile.accounts.map(account => <tr key={account.accountId}><td><Link href={`/accounts/${account.accountId}`}>{account.accountNumber}</Link></td><td>{account.status}</td><td className="amount">{displayMoney(account.currentBalance)}</td></tr>)}</tbody></table></div> : <p>No linked accounts.</p>}</section>
      <CustomerFixedDepositsPanel key={profile.customer.customerId} customerId={profile.customer.customerId} />
    </>}
  </>;
}
