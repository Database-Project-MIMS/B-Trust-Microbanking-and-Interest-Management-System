"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { FixedDepositDetail } from "@/services/fixed-deposit-service";
import { accountRequest } from "@/app/accounts/account-client";
import { displayDate, displayMoney, displayRate } from "@/app/accounts/account-format";
import { RecordDetails } from "@/components/mims/record-details";

export function FixedDepositDetails({ id, canEditAccount, canRunInterest }: {
  id: string; canEditAccount: boolean; canRunInterest: boolean;
}) {
  const [deposit, setDeposit] = useState<FixedDepositDetail | null>(null);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController(); setDeposit(null); setError("");
    accountRequest<FixedDepositDetail>(`/api/fixed-deposits/${encodeURIComponent(id)}`, { signal: controller.signal }).then(response => {
      if (controller.signal.aborted) return;
      if (response.ok && response.data) setDeposit(response.data);
      else setError(response.error?.message ?? "Unable to load the fixed deposit.");
    }).catch(() => { if (!controller.signal.aborted) setError("Unable to load the fixed deposit."); });
    return () => controller.abort();
  }, [id, attempt]);
  return <>
    <div className="page-header"><div><p className="eyebrow">Fixed deposit</p><h1 className="page-title">{deposit?.productName ?? "Fixed deposit details"}</h1></div>
      <Link className="btn btn-secondary" href="/fixed-deposits">Back to fixed deposits</Link></div>
    {error ? <div role="alert" className="card mt-6"><p>{error}</p><button className="btn btn-secondary" onClick={() => setAttempt(value => value + 1)}>Retry</button></div> :
      !deposit ? <p role="status" className="card mt-6">Loading fixed deposit…</p> : <>
        <div className="detail-grid mt-6">
          <section className="card"><h2>Deposit terms</h2><RecordDetails items={[
            { label: "Product", value: deposit.productName }, { label: "Principal", value: displayMoney(deposit.principalAmount) },
            { label: "Rate at opening", value: displayRate(deposit.rate) }, { label: "Opened", value: displayDate(deposit.startDate) },
            { label: "Maturity date", value: displayDate(deposit.maturityDate) }, { label: "Next interest date", value: displayDate(deposit.nextInterestDate) },
            { label: "Status", value: deposit.status }, { label: "Created", value: displayDate(deposit.createdAt) },
            { label: "Last updated", value: displayDate(deposit.updatedAt) },
          ]} /><p className="muted mt-4">Principal, rate and opening dates are fixed. Interest and maturity are processed through the central interest cycle.</p></section>
          <section className="card"><h2>Linked savings account</h2><RecordDetails items={[
            { label: "Account number", value: <Link href={`/accounts/${deposit.accountId}`}>{deposit.accountNumber}</Link> },
            { label: "Savings plan", value: deposit.account.planName }, { label: "Account status", value: deposit.account.status },
            { label: "Current savings balance", value: displayMoney(deposit.account.currentBalance) },
            { label: "Branch", value: `${deposit.account.branchCode} — ${deposit.account.branchName}` },
          ]} /><div className="flex flex-wrap gap-2 mt-4">
            <Link className="btn btn-secondary" href={`/accounts/${deposit.accountId}`}>View account</Link>
            {canEditAccount && deposit.account.status !== "CLOSED" && <Link className="btn btn-secondary" href={`/accounts/${deposit.accountId}?edit=1`}>Edit linked account</Link>}
            {canRunInterest && <Link className="btn btn-secondary" href="/interest-runs">Interest run console</Link>}
          </div></section>
        </div>
        <section className="card mt-6"><h2>Account owners</h2><p className="muted">Holder details available within your current access permissions.</p>
          <div className="table-wrap mt-4"><table className="data-table"><caption className="sr-only">Owners of the linked savings account</caption>
            <thead><tr><th scope="col">Name</th><th scope="col">Customer number</th><th scope="col">Holder role</th><th scope="col">Actions</th></tr></thead>
            <tbody>{deposit.holders.map(holder => <tr key={holder.customerId}><th scope="row" className="font-normal">{holder.fullName}</th>
              <td>{holder.customerNumber}</td><td>{holder.holderType === "PRIMARY" ? "Primary" : "Joint"}</td>
              <td><Link className="btn btn-secondary" href={`/customers/${holder.customerId}`} aria-label={`View details for ${holder.fullName}`}>View customer</Link></td></tr>)}
              {!deposit.holders.length && <tr><td colSpan={4}>No holder details are available within your scope.</td></tr>}</tbody>
          </table></div>
        </section>
      </>}
  </>;
}
