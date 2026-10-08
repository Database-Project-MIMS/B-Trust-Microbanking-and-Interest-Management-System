"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { accountRequest, csrfToken } from "../account-client";
import { displayDate, displayMoney, displayRate, eligibilitySummary } from "../account-format";
import {
  EMPTY_OPENING, addHolder, allowsMandate, buildOpenBody, describeError, holderRole, keyFor, makePrimary,
  removeHolder, reviewProblems, selectPlan, type ErrorField, type KeyRecord, type MandateType, type OpeningState, type PlanOption,
} from "./account-opening-model";
import { CustomerPicker } from "./customer-picker";

interface Opened { accountId: string; accountNumber: string; currentBalance: string }

export function AccountOpening({ plans, branchId }: { plans: PlanOption[]; branchId: string }) {
  const router = useRouter();
  const [state, setState] = useState<OpeningState>(EMPTY_OPENING);
  const [step, setStep] = useState<"edit" | "review">("edit");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<{ field: ErrorField; message: string } | null>(null);
  const [pickMessage, setPickMessage] = useState("");
  const key = useRef<KeyRecord | null>(null);
  const plan = plans.find(candidate => candidate.planId === state.planId);
  const problems = reviewProblems(state, plan);
  const fieldError = (field: ErrorField) => error?.field === field ? <p role="alert" className="text-[var(--danger)]">{error.message}</p> : null;

  async function submit() {
    if (!plan || saving) return;
    const body = buildOpenBody(state, plan, branchId);
    const token = csrfToken();
    if (!token) { setError({ field: "general", message: "Your security token is missing. Sign in again before opening an account." }); return; }
    key.current = keyFor(key.current, body);
    setSaving(true); setError(null);
    const response = await accountRequest<Opened>("/api/accounts", {
      method: "POST", headers: { "Content-Type": "application/json", "x-csrf-token": token, "Idempotency-Key": key.current.key }, body: JSON.stringify(body),
    });
    if (response.ok && response.data) {
      router.push(`/accounts/${response.data.accountId}?notice=${response.status === 200 ? "existing" : "opened"}`);
      return;
    }
    const view = describeError(response.error ?? { code: "REQUEST_FAILED", message: "Account opening failed." });
    if (view.newKey) key.current = null;
    setError({ field: view.field, message: view.message });
    setSaving(false); setStep("edit");
  }

  return <>
    <div className="page-header"><div><p className="eyebrow">Savings accounts</p><h1 className="page-title">Open savings account</h1></div>
      <Link className="btn btn-secondary" href="/accounts">Back to accounts</Link></div>

    {step === "review" && plan ? <section className="card confirmation-card mt-6" aria-labelledby="review-title">
      <p className="eyebrow">Confirmation required</p><h2 id="review-title">Review account opening</h2>
      <dl>
        <div><dt>Plan</dt><dd>{plan.planName} · {displayRate(plan.interestRate)} a year</dd></div>
        <div><dt>Minimum balance</dt><dd className="amount">{displayMoney(plan.minBalance)}</dd></div>
        {state.holders.map((holder, index) => <div key={holder.customerId}><dt>{holderRole(index) === "PRIMARY" ? "Primary holder" : "Joint holder"}</dt><dd>{holder.fullName} · {holder.customerNumber}</dd></div>)}
        {allowsMandate(plan) && <div><dt>Withdrawals</dt><dd>{state.mandateType === "ALL_HOLDERS" ? `All ${state.holders.length} holders must authorise` : "Any one holder may authorise"}</dd></div>}
        <div><dt>Initial deposit</dt><dd className="amount">{state.deposit.trim() ? displayMoney(state.deposit.trim()) : "None"}</dd></div>
        <div><dt>Opening balance</dt><dd className="amount">{displayMoney(state.deposit.trim() || "0")}</dd></div>
      </dl>
      <p className="muted">The server checks eligibility, documents and limits when you confirm. Nothing is saved until then.</p>
      {error && <p role="alert" className="text-[var(--danger)] mt-4">{error.message}</p>}
      <div className="flex gap-3 mt-6">
        <button className="btn btn-secondary" type="button" disabled={saving} onClick={() => setStep("edit")}>Edit application</button>
        <button className="btn btn-primary" type="button" disabled={saving} onClick={() => void submit()}>{saving ? "Opening account…" : "Confirm and open account"}</button>
      </div>
    </section> : <form className="card form-grid mt-6" onSubmit={event => { event.preventDefault(); if (!problems.length) { setError(null); setStep("review"); } }}>
      <fieldset className="form-section" disabled={saving}><legend className="section-heading">Savings plan</legend>
        <label className="field">Plan *<select className="input" required value={state.planId} onChange={event => setState(current => selectPlan(current, plans.find(candidate => candidate.planId === event.target.value)))}>
          <option value="">Select a plan</option>
          {plans.map(candidate => <option key={candidate.planId} value={candidate.planId}>{candidate.planName} · {displayRate(candidate.interestRate)} · minimum {displayMoney(candidate.minBalance)}</option>)}
        </select></label>
        {plan && <p className="muted">{plan.description ? `${plan.description}. ` : ""}Eligibility: {eligibilitySummary(plan)}. The server confirms eligibility when you submit.</p>}
        {fieldError("plan")}
      </fieldset>

      <fieldset className="form-section" disabled={saving}><legend className="section-heading">Holders</legend>
        {!plan ? <p className="muted">Choose a plan to add holders.</p> : <>
          <p className="muted">{plan.maxHolders === 1 ? "This plan has one holder." : `Add ${plan.minHolders} to ${plan.maxHolders} adult holders. The first holder is the primary applicant.`} Required fields are marked *.</p>
          <div className="table-wrap" aria-label="Selected holders"><table className="data-table"><thead><tr><th>Role</th><th>Name</th><th>Customer number</th><th>Date of birth</th><th><span className="sr-only">Actions</span></th></tr></thead><tbody>
            {state.holders.map((holder, index) => <tr key={holder.customerId}>
              <td>{holderRole(index) === "PRIMARY" ? "Primary" : "Joint"}</td><td>{holder.fullName}</td><td>{holder.customerNumber}</td><td>{displayDate(holder.dateOfBirth)}</td>
              <td className="flex gap-2">
                {index > 0 && <button className="btn btn-secondary" type="button" onClick={() => setState(current => makePrimary(current, holder.customerId))}>Make primary</button>}
                <button className="btn btn-secondary" type="button" aria-label={`Remove ${holder.fullName}`} onClick={() => setState(current => removeHolder(current, holder.customerId))}>Remove</button>
              </td></tr>)}
            {!state.holders.length && <tr><td colSpan={5}>No holders added yet.</td></tr>}
          </tbody></table></div>
          {state.holders.length < plan.maxHolders && <CustomerPicker label={state.holders.length ? "Add another holder" : "Find the holder"} actionLabel="Add" excludeIds={state.holders.map(holder => holder.customerId)}
            onPick={holder => { const next = addHolder(state, plan, holder); setPickMessage(next.error ?? ""); setState(next.state); }} />}
          {pickMessage && <p role="alert" className="text-[var(--danger)]">{pickMessage}</p>}
        </>}
        {fieldError("holders")}
      </fieldset>

      {allowsMandate(plan) && <fieldset className="form-section" disabled={saving}><legend className="section-heading">Operating mandate</legend>
        <label className="field">Who may authorise a withdrawal? *<select className="input" required value={state.mandateType} onChange={event => setState(current => ({ ...current, mandateType: event.target.value as MandateType }))}>
          <option value="">Select a mandate</option><option value="ANY_ONE">Any one holder</option><option value="ALL_HOLDERS">All holders together</option></select></label>
        {fieldError("mandate")}
      </fieldset>}

      <fieldset className="form-section" disabled={saving}><legend className="section-heading">Initial deposit</legend>
        <label className="field">Amount (LKR), optional<input className="input" inputMode="decimal" autoComplete="off" value={state.deposit} placeholder="0.00"
          onChange={event => setState(current => ({ ...current, deposit: event.target.value }))} aria-describedby="deposit-help" />
          <small id="deposit-help">{plan ? `Must be at least ${displayMoney(plan.minBalance)} if entered. ` : ""}Deposits are only accepted during business hours.</small></label>
        {fieldError("deposit")}
      </fieldset>

      {fieldError("general")}
      {problems.length > 0 && <ul className="muted" aria-label="Before you can review">{problems.map(problem => <li key={problem}>{problem}</li>)}</ul>}
      <button className="btn btn-primary" type="submit" disabled={saving || problems.length > 0}>Review account opening</button>
    </form>}
  </>;
}
