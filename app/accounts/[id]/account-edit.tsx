"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { AccountDetail } from "@/services/account-service";
import { RecordEditForm, type EditField } from "@/components/mims/record-edit-form";
import { accountRequest, csrfToken } from "../account-client";

export function AccountEdit({ account, onSaved }: { account: AccountDetail; onSaved: () => void }) {
  const router = useRouter();
  const href = `/accounts/${account.accountId}`;
  const [confirmClose, setConfirmClose] = useState(false);
  const [closing, setClosing] = useState(false);
  const [error, setError] = useState("");
  const fields: EditField[] = [{ name: "status", label: "Account status", value: account.status,
    options: ["ACTIVE", "FROZEN"].map(value => ({ value, label: value })), required: true }];
  if (account.mandate) fields.push(
    { name: "mandateType", label: "Withdrawal mandate", value: account.mandate.mandateType, required: true,
      options: [{ value: "ANY_ONE", label: "Any one holder" }, { value: "ALL_HOLDERS", label: "All holders" }] },
    { name: "effectiveFrom", label: "Mandate effective from", value: account.mandate.effectiveFrom, type: "date", required: true },
    { name: "effectiveTo", label: "Mandate effective to (optional)", value: account.mandate.effectiveTo ?? "", type: "date", nullable: true },
  );
  async function close() {
    if (closing) return;
    setClosing(true); setError("");
    const response = await accountRequest(`/api${href}/close`, { method: "POST", headers: { "x-csrf-token": csrfToken() } });
    setClosing(false);
    if (response.ok) { router.replace(href); onSaved(); }
    else setError(response.error?.message ?? "The account could not be closed.");
  }
  if (account.status === "CLOSED") return <p role="status" className="card mt-6">Closed accounts cannot be edited.</p>;
  return <>
    <RecordEditForm title="Edit account" endpoint={`/api${href}`} fields={fields}
      description="Freezing stops financial posting, including interest. Balances, plan, branch and opening history stay fixed. Mandate signatures follow the holder count."
      onCancel={() => router.replace(href)} onSaved={() => { router.replace(href); onSaved(); }} buildPatch={patch => {
        const result: { status?: string | null; mandate?: { type: string; effectiveFrom: string; effectiveTo: string | null } } = {};
        if (patch.status) result.status = patch.status;
        if (account.mandate && ["mandateType", "effectiveFrom", "effectiveTo"].some(field => field in patch)) {
          result.mandate = { type: patch.mandateType ?? account.mandate.mandateType,
            effectiveFrom: patch.effectiveFrom ?? account.mandate.effectiveFrom,
            effectiveTo: "effectiveTo" in patch ? patch.effectiveTo ?? null : account.mandate.effectiveTo };
        }
        return result;
      }} />
    {account.status === "ACTIVE" && <section className="card mt-6 space-y-4"><h2>Close account</h2>
      <p className="muted">Closure requires zero balance, no active fixed deposit and no positive unpaid savings interest.</p>
      {!confirmClose ? <button className="btn btn-secondary" type="button" onClick={() => setConfirmClose(true)}>Close account</button> :
        <div className="confirmation-card"><p>Close account {account.accountNumber}? This preserves its history and permanently prevents new postings.</p>
          <div className="flex flex-wrap gap-3 mt-4"><button className="btn btn-secondary" disabled={closing} onClick={() => setConfirmClose(false)} type="button">Cancel closure</button>
            <button className="btn btn-primary" disabled={closing} onClick={() => void close()} type="button">{closing ? "Closing…" : "Confirm closure"}</button></div>
        </div>}
      {error && <p role="alert" className="text-[var(--danger)]">{error}</p>}
    </section>}
  </>;
}
