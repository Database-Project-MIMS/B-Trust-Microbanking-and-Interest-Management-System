"use client";

import { useEffect, useRef, useState } from "react";
import type { SavingsPlan } from "@/services/savings-plan-service";
import { accountRequest, csrfToken } from "../accounts/account-client";
import { displayMoney, displayRate, eligibilitySummary } from "../accounts/account-format";
import { trapTab } from "./dialog-focus";
import { diffDraft, draftFromPlan, validateDraft, type DraftField, type EditDraft } from "./plan-edit-model";

interface SavingsPlanClientProps {
  initialPlans: SavingsPlan[];
  canEdit: boolean;
}

export default function SavingsPlanClient({ initialPlans, canEdit }: SavingsPlanClientProps) {
  const [editingPlan, setEditingPlan] = useState<SavingsPlan | null>(null);
  const [draft, setDraft] = useState<EditDraft | null>(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [attempted, setAttempted] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  const opener = useRef<HTMLElement | null>(null);

  function close() {
    setEditingPlan(null); setDraft(null); setError(""); setAttempted(false);
    opener.current?.focus();
  }

  // Esc closes the dialog; focus moves into it when it opens (docs/11 Dialogs).
  useEffect(() => {
    if (!editingPlan) return;
    dialogRef.current?.querySelector<HTMLElement>("input, select, textarea")?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !saving) { close(); return; }
      if (dialogRef.current) trapTab(event, dialogRef.current);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
    // close() only touches state setters and a ref, so it is safe to omit from the dependencies.
  }, [editingPlan, saving]);

  function edit(plan: SavingsPlan, trigger: HTMLElement) {
    opener.current = trigger;
    setEditingPlan(plan); setDraft(draftFromPlan(plan)); setError(""); setAttempted(false);
  }

  const errors = draft ? validateDraft(draft) : {};
  const shown = (field: DraftField) => (attempted ? errors[field] : undefined);
  const hint = (field: DraftField) => shown(field)
    ? <small id={`plan-${field}-error`} role="alert" className="text-[var(--danger)]">{shown(field)}</small> : null;
  const invalid = (field: DraftField) => (shown(field) ? { "aria-invalid": true, "aria-describedby": `plan-${field}-error` } as const : {});

  async function submitEdit() {
    if (!editingPlan || !draft || saving) return;
    setAttempted(true);
    if (Object.keys(validateDraft(draft)).length > 0) return;
    const body = diffDraft(editingPlan, draft);
    if (Object.keys(body).length === 0) { close(); return; }
    const token = csrfToken();
    if (!token) { setError("Your security token is missing. Sign in again before saving."); return; }
    setSaving(true); setError("");
    const response = await accountRequest<SavingsPlan>(`/api/plans/${editingPlan.planId}`, {
      method: "PATCH", headers: { "Content-Type": "application/json", "x-csrf-token": token }, body: JSON.stringify(body),
    });
    if (!response.ok) { setError(response.error?.message ?? "Failed to update the plan."); setSaving(false); return; }
    window.location.reload();
  }

  return <>
    <section className="card" aria-label="Savings plans">
      <div className="table-wrap"><table className="data-table">
        <thead><tr><th>Plan</th><th className="amount">Interest rate</th><th className="amount">Minimum balance</th><th>Eligibility</th><th>Status</th>{canEdit && <th><span className="sr-only">Actions</span></th>}</tr></thead>
        <tbody>
          {initialPlans.map(plan => <tr key={plan.planId}>
            <td><strong>{plan.planName}</strong>{plan.description && <div className="muted">{plan.description}</div>}</td>
            <td className="amount">{displayRate(plan.interestRate)}</td>
            <td className="amount">{displayMoney(plan.minBalance)}</td>
            <td>{eligibilitySummary(plan)}</td>
            <td><span className="status-pill">{plan.status}</span></td>
            {canEdit && <td><button className="btn btn-secondary" type="button" aria-label={`Edit ${plan.planName}`} onClick={event => edit(plan, event.currentTarget)}>Edit</button></td>}
          </tr>)}
          {!initialPlans.length && <tr><td colSpan={canEdit ? 6 : 5}>No savings plans are configured.</td></tr>}
        </tbody>
      </table></div>
    </section>

    {editingPlan && draft && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="presentation">
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="plan-dialog-title" className="card w-full max-w-lg max-h-full overflow-y-auto">
        <h2 id="plan-dialog-title">Edit {editingPlan.planName}</h2>
        <p className="muted mt-2">Changes apply to accounts opened from now on. Rates are fractions: 13% is 0.1300.</p>
        <div className="form-grid mt-6">
          <div className="two-col">
            <label className="field">Interest rate (fraction)<input className="input" inputMode="decimal" value={draft.interestRate} onChange={e => setDraft({ ...draft, interestRate: e.target.value })} {...invalid("interestRate")} />{hint("interestRate")}</label>
            <label className="field">Minimum balance (LKR)<input className="input" inputMode="decimal" value={draft.minBalance} onChange={e => setDraft({ ...draft, minBalance: e.target.value })} {...invalid("minBalance")} />{hint("minBalance")}</label>
          </div>
          <label className="field">Description<textarea className="input" maxLength={255} value={draft.description} onChange={e => setDraft({ ...draft, description: e.target.value })} /></label>
          <label className="field">Status<select className="input" value={draft.status} onChange={e => setDraft({ ...draft, status: e.target.value as "ACTIVE" | "INACTIVE" })}><option value="ACTIVE">ACTIVE</option><option value="INACTIVE">INACTIVE</option></select></label>
          <div className="two-col">
            <label className="field">Minimum age (blank for no limit)<input className="input" inputMode="numeric" value={draft.minAgeYears} onChange={e => setDraft({ ...draft, minAgeYears: e.target.value })} {...invalid("minAgeYears")} />{hint("minAgeYears")}</label>
            <label className="field">Maximum age (blank for no limit)<input className="input" inputMode="numeric" value={draft.maxAgeYears} onChange={e => setDraft({ ...draft, maxAgeYears: e.target.value })} {...invalid("maxAgeYears")} />{hint("maxAgeYears")}</label>
            <label className="field">Minimum holders<input className="input" inputMode="numeric" value={draft.minHolders} onChange={e => setDraft({ ...draft, minHolders: e.target.value })} {...invalid("minHolders")} />{hint("minHolders")}</label>
            <label className="field">Maximum holders<input className="input" inputMode="numeric" value={draft.maxHolders} onChange={e => setDraft({ ...draft, maxHolders: e.target.value })} {...invalid("maxHolders")} />{hint("maxHolders")}</label>
          </div>
          <label className="check-field"><input type="checkbox" checked={draft.requiresAllAdult} onChange={e => setDraft({ ...draft, requiresAllAdult: e.target.checked })} />Every holder must be an adult</label>
        </div>
        {error && <p role="alert" className="text-[var(--danger)] mt-4">{error}</p>}
        <div className="flex justify-end gap-3 mt-6">
          <button className="btn btn-secondary" type="button" onClick={close} disabled={saving}>Cancel</button>
          <button className="btn btn-primary" type="button" onClick={() => void submitEdit()} disabled={saving}>{saving ? "Saving…" : "Save changes"}</button>
        </div>
      </div>
    </div>}
  </>;
}
