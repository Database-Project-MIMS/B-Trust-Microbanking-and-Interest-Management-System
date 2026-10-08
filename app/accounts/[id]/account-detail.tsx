"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { AccountDetail as Detail } from "@/services/account-service";
import { accountRequest, csrfToken } from "../account-client";
import { authoritySummary, displayDate, displayMoney, holderAuthority, transactionTypeLabel } from "../account-format";
import type { HolderChoice } from "../new/account-opening-model";
import { CustomerPicker } from "../new/customer-picker";

const NOTICES: Record<string, string> = {
  opened: "Account opened.",
  existing: "This account was already opened by an earlier submission. Nothing was changed.",
};

export function AccountDetail({ id, canAddHolder, canBrowse, notice }: { id: string; canAddHolder: boolean; canBrowse: boolean; notice?: string }) {
  const [account, setAccount] = useState<Detail | null>(null);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const [candidate, setCandidate] = useState<HolderChoice | null>(null);
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState("");
  const [added, setAdded] = useState("");

  useEffect(() => {
    const controller = new AbortController(); setAccount(null); setError("");
    accountRequest<Detail>(`/api/accounts/${encodeURIComponent(id)}`, { signal: controller.signal })
      .then(response => {
        if (controller.signal.aborted) return;
        if (response.ok && response.data) setAccount(response.data); else setError(response.error?.message ?? "Unable to load the account.");
      }).catch(() => { /* aborted */ });
    return () => controller.abort();
  }, [id, attempt]);

  async function addHolder() {
    if (!candidate || adding) return;
    const token = csrfToken();
    if (!token) { setAddError("Your security token is missing. Sign in again before adding a holder."); return; }
    setAdding(true); setAddError(""); setAdded("");
    const response = await accountRequest<{ holderCount: number }>(`/api/accounts/${encodeURIComponent(id)}/holders`, {
      method: "POST", headers: { "Content-Type": "application/json", "x-csrf-token": token }, body: JSON.stringify({ customerId: candidate.customerId }),
    });
    setAdding(false);
    if (response.ok) {
      setAdded(`${candidate.fullName} was added as a joint holder.`); setCandidate(null); setAttempt(value => value + 1);
    } else if (response.error?.code === "DUPLICATE_HOLDER") {
      // A repeated click after success: the holder is already on the account.
      setAdded(`${candidate.fullName} already holds this account.`); setCandidate(null); setAttempt(value => value + 1);
    } else setAddError(response.error?.message ?? "The holder could not be added.");
  }

  const header = <div className="page-header"><div><p className="eyebrow">Savings account</p><h1 className="page-title">{account?.accountNumber ?? "Account"}</h1></div>
    {canBrowse && <Link className="btn btn-secondary" href="/accounts">Back to accounts</Link>}</div>;
  if (error) return <>{header}<div role="alert" className="card mt-6"><p>{error}</p><button className="btn btn-secondary" onClick={() => setAttempt(value => value + 1)}>Retry</button></div></>;
  if (!account) return <>{header}<p role="status" className="mt-6">Loading account…</p></>;

  const full = account.holderCount >= account.maxHolders;
  const authority = authoritySummary({ holderCount: account.holderCount, mandate: account.mandate });
  const withdrawalsClosed = account.status !== "ACTIVE";
  const canAdd = canAddHolder && account.status === "ACTIVE" && account.maxHolders > 1 && !full;

  return <>
    {header}
    {notice && NOTICES[notice] && <p role="status" className="card mt-6">{NOTICES[notice]}</p>}
    {withdrawalsClosed && <p role="status" className="card mt-6">This account is {account.status.toLowerCase()}. Withdrawals are not allowed.</p>}
    <div className="detail-grid mt-6">
      <section className="card balance-card"><p>Current balance</p><strong className="amount">{displayMoney(account.currentBalance)}</strong><span className="status-pill">{account.status}</span>
        <dl className="mt-5">
          <div><dt>Available to withdraw</dt><dd className="amount">{withdrawalsClosed ? "—" : displayMoney(account.availableToWithdraw)}</dd></div>
          <div><dt>Last transaction</dt><dd>{account.lastTransaction
            ? `${transactionTypeLabel(account.lastTransaction.transactionType)} of ${displayMoney(account.lastTransaction.amount)} on ${displayDate(account.lastTransaction.transactionDate)} (${account.lastTransaction.referenceNumber})`
            : "No transactions yet"}</dd></div></dl>
        <p className="muted mt-4">The plan minimum of {displayMoney(account.minBalance)} stays in the account.</p></section>
      <section className="card"><h2>Plan</h2><dl>
        <div><dt>Plan</dt><dd>{account.planName}</dd></div><div><dt>Minimum balance</dt><dd className="amount">{displayMoney(account.minBalance)}</dd></div>
        <div><dt>Opened</dt><dd>{displayDate(account.openedDate)}</dd></div><div><dt>Holders</dt><dd>{account.holderCount} of {account.maxHolders} allowed</dd></div></dl></section>
      <section className="card"><h2>Who can authorise withdrawals</h2>
        {authority.stateLabel && <span className="status-pill">{authority.stateLabel}</span>}
        <p className={authority.blocked ? "text-[var(--danger)]" : undefined}>{authority.text}</p>
        {account.mandate && <p className="muted">Effective from {displayDate(account.mandate.effectiveFrom)}{account.mandate.effectiveTo ? ` to ${displayDate(account.mandate.effectiveTo)}` : ""}.</p>}</section>
    </div>

    <section className="card mt-6"><h2>Holders</h2>
      <div className="table-wrap mt-4"><table className="data-table"><thead><tr><th>Name</th><th>Customer number</th><th>Role</th><th>Authority</th><th>Joined</th></tr></thead><tbody>
        {account.holders.map(holder => <tr key={holder.accountHolderId}><td><Link href={`/customers/${holder.customerId}`}>{holder.fullName}</Link></td><td>{holder.customerNumber}</td>
          <td>{holder.holderType === "PRIMARY" ? "Primary" : "Joint"}</td><td>{holderAuthority(account.mandate, account.holderCount)}</td><td>{displayDate(holder.joinedDate)}</td></tr>)}
        {!account.holders.length && <tr><td colSpan={5}>No holders are visible to you.</td></tr>}
      </tbody></table></div>
      {account.holders.length < account.holderCount && <p className="muted mt-4">You can see {account.holders.length} of {account.holderCount} holders.</p>}
    </section>

    {canAddHolder && <section className="card mt-6" aria-labelledby="add-holder-title"><h2 id="add-holder-title">Add a joint holder</h2>
      {!canAdd ? <p className="muted">{account.status !== "ACTIVE" ? "Holders can only be added to an active account." : account.maxHolders <= 1 ? "This is a single-holder plan." : `This account already has the maximum of ${account.maxHolders} holders.`}</p> : <>
        {!candidate ? <CustomerPicker label="Find the customer to add" actionLabel="Select" excludeIds={account.holders.map(holder => holder.customerId)} disabled={adding} onPick={holder => { setCandidate(holder); setAddError(""); setAdded(""); }} /> :
          <div className="confirmation-card"><p>Add <strong>{candidate.fullName}</strong> ({candidate.customerNumber}) as a joint holder? The account will have {account.holderCount + 1} holders.
            {account.mandate?.mandateType === "ALL_HOLDERS" ? ` All ${account.holderCount + 1} holders will then have to authorise a withdrawal.` : ""}</p>
            <div className="flex gap-3 mt-4"><button className="btn btn-secondary" type="button" disabled={adding} onClick={() => setCandidate(null)}>Choose someone else</button>
              <button className="btn btn-primary" type="button" disabled={adding} onClick={() => void addHolder()}>{adding ? "Adding holder…" : "Confirm and add holder"}</button></div></div>}
      </>}
      {addError && <p role="alert" className="text-[var(--danger)] mt-4">{addError}</p>}
      {added && <p role="status" className="mt-4">{added}</p>}
    </section>}
  </>;
}
