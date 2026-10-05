"use client";

import { useState } from "react";
import type { SavingsPlan } from "@/services/savings-plan-service";

interface SavingsPlanClientProps {
  initialPlans: SavingsPlan[];
  canEdit: boolean;
  csrfToken: string;
}

interface EditDraft {
  interestRate: string;
  minBalance: string;
  description: string;
  status: "ACTIVE" | "INACTIVE";
  minAgeYears: string;
  maxAgeYears: string;
  minHolders: string;
  maxHolders: string;
  requiresAllAdult: boolean;
}

function draftFromPlan(plan: SavingsPlan): EditDraft {
  return {
    interestRate: plan.interestRate,
    minBalance: plan.minBalance,
    description: plan.description ?? "",
    status: plan.status,
    minAgeYears: plan.minAgeYears == null ? "" : String(plan.minAgeYears),
    maxAgeYears: plan.maxAgeYears == null ? "" : String(plan.maxAgeYears),
    minHolders: String(plan.minHolders),
    maxHolders: String(plan.maxHolders),
    requiresAllAdult: plan.requiresAllAdult,
  };
}

function eligibilitySummary(plan: SavingsPlan): string {
  const age =
    plan.minAgeYears == null && plan.maxAgeYears == null
      ? "No age limit"
      : plan.minAgeYears == null
        ? `Up to age ${plan.maxAgeYears}`
        : plan.maxAgeYears == null
          ? `Age ${plan.minAgeYears}+`
          : `Age ${plan.minAgeYears}–${plan.maxAgeYears}`;

  const holders =
    plan.minHolders === 1 && plan.maxHolders === 1
      ? null
      : `${plan.minHolders}–${plan.maxHolders} holders`;

  const parts = [age, holders, plan.requiresAllAdult ? "all adult" : null].filter(
    (part): part is string => part !== null,
  );

  return parts.join(", ");
}

/** Builds a PATCH body containing only the fields that actually changed. */
function diffDraft(original: SavingsPlan, draft: EditDraft): Record<string, unknown> {
  const body: Record<string, unknown> = {};

  if (draft.interestRate !== original.interestRate) body.interestRate = draft.interestRate;
  if (draft.minBalance !== original.minBalance) body.minBalance = draft.minBalance;

  const description = draft.description.trim() === "" ? null : draft.description.trim();
  if (description !== original.description) body.description = description;

  if (draft.status !== original.status) body.status = draft.status;

  const minAgeYears = draft.minAgeYears === "" ? null : Number(draft.minAgeYears);
  if (minAgeYears !== original.minAgeYears) body.minAgeYears = minAgeYears;

  const maxAgeYears = draft.maxAgeYears === "" ? null : Number(draft.maxAgeYears);
  if (maxAgeYears !== original.maxAgeYears) body.maxAgeYears = maxAgeYears;

  const minHolders = Number(draft.minHolders);
  if (minHolders !== original.minHolders) body.minHolders = minHolders;

  const maxHolders = Number(draft.maxHolders);
  if (maxHolders !== original.maxHolders) body.maxHolders = maxHolders;

  if (draft.requiresAllAdult !== original.requiresAllAdult) {
    body.requiresAllAdult = draft.requiresAllAdult;
  }

  return body;
}

export default function SavingsPlanClient({
  initialPlans,
  canEdit,
  csrfToken,
}: SavingsPlanClientProps) {
  const [plans] = useState<SavingsPlan[]>(initialPlans);
  const [editingPlan, setEditingPlan] = useState<SavingsPlan | null>(null);
  const [draft, setDraft] = useState<EditDraft | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const handleEdit = (plan: SavingsPlan) => {
    setEditingPlan(plan);
    setDraft(draftFromPlan(plan));
    setError(null);
  };

  const submitEdit = async () => {
    if (!editingPlan || !draft) return;

    const body = diffDraft(editingPlan, draft);
    if (Object.keys(body).length === 0) {
      setEditingPlan(null);
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const res = await fetch(`/api/plans/${editingPlan.planId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "x-csrf-token": csrfToken,
        },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error?.message || "Failed to update plan.");
      }

      window.location.reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update plan.");
      setSaving(false);
    }
  };

  return (
    <div className="card">
      <table className="data-table">
        <thead>
          <tr>
            <th>Plan Name</th>
            <th className="text-right">Interest Rate</th>
            <th className="text-right">Min Balance</th>
            <th>Description</th>
            <th>Status</th>
            <th>Eligibility</th>
            {canEdit && <th className="text-right">Actions</th>}
          </tr>
        </thead>
        <tbody>
          {plans.map((plan) => (
            <tr key={plan.planId}>
              <td className="font-body font-medium text-on-surface">{plan.planName}</td>
              <td className="amount">{(Number(plan.interestRate) * 100).toFixed(2)}%</td>
              <td className="amount">{Number(plan.minBalance).toFixed(2)}</td>
              <td className="text-on-surface-variant">{plan.description ?? "—"}</td>
              <td>
                <span className={plan.status === "ACTIVE" ? "tag tag-success" : "tag tag-neutral"}>
                  {plan.status}
                </span>
              </td>
              <td className="text-on-surface-variant">{eligibilitySummary(plan)}</td>
              {canEdit && (
                <td className="text-right">
                  <button className="btn btn-ghost" onClick={() => handleEdit(plan)}>
                    Edit
                  </button>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>

      {editingPlan && draft && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="card w-full max-w-md">
            <h3 className="font-headline text-headline-sm text-on-surface mb-space-sm">
              Edit {editingPlan.planName}
            </h3>

            {error && (
              <div className="tag tag-danger mb-space-sm normal-case tracking-normal font-body text-body-sm">
                {error}
              </div>
            )}

            <div className="flex flex-col gap-space-sm">
              <label className="text-body-sm text-on-surface-variant">
                Interest Rate (fraction, e.g. 0.1300)
                <input
                  className="input mt-1"
                  value={draft.interestRate}
                  onChange={(e) => setDraft({ ...draft, interestRate: e.target.value })}
                />
              </label>

              <label className="text-body-sm text-on-surface-variant">
                Minimum Balance
                <input
                  className="input mt-1"
                  value={draft.minBalance}
                  onChange={(e) => setDraft({ ...draft, minBalance: e.target.value })}
                />
              </label>

              <label className="text-body-sm text-on-surface-variant">
                Description
                <textarea
                  className="input mt-1"
                  maxLength={255}
                  value={draft.description}
                  onChange={(e) => setDraft({ ...draft, description: e.target.value })}
                />
              </label>

              <label className="text-body-sm text-on-surface-variant">
                Status
                <select
                  className="input mt-1"
                  value={draft.status}
                  onChange={(e) =>
                    setDraft({ ...draft, status: e.target.value as "ACTIVE" | "INACTIVE" })
                  }
                >
                  <option value="ACTIVE">ACTIVE</option>
                  <option value="INACTIVE">INACTIVE</option>
                </select>
              </label>

              <div className="grid grid-cols-2 gap-space-sm">
                <label className="text-body-sm text-on-surface-variant">
                  Min Age Years (blank = no limit)
                  <input
                    className="input mt-1"
                    value={draft.minAgeYears}
                    onChange={(e) => setDraft({ ...draft, minAgeYears: e.target.value })}
                  />
                </label>
                <label className="text-body-sm text-on-surface-variant">
                  Max Age Years (blank = no limit)
                  <input
                    className="input mt-1"
                    value={draft.maxAgeYears}
                    onChange={(e) => setDraft({ ...draft, maxAgeYears: e.target.value })}
                  />
                </label>
              </div>

              <div className="grid grid-cols-2 gap-space-sm">
                <label className="text-body-sm text-on-surface-variant">
                  Min Holders
                  <input
                    className="input mt-1"
                    value={draft.minHolders}
                    onChange={(e) => setDraft({ ...draft, minHolders: e.target.value })}
                  />
                </label>
                <label className="text-body-sm text-on-surface-variant">
                  Max Holders
                  <input
                    className="input mt-1"
                    value={draft.maxHolders}
                    onChange={(e) => setDraft({ ...draft, maxHolders: e.target.value })}
                  />
                </label>
              </div>

              <label className="flex items-center gap-2 text-body-sm text-on-surface-variant">
                <input
                  type="checkbox"
                  checked={draft.requiresAllAdult}
                  onChange={(e) => setDraft({ ...draft, requiresAllAdult: e.target.checked })}
                />
                Requires every holder to be an adult
              </label>

              <div className="flex justify-end gap-2 mt-space-sm">
                <button
                  className="btn btn-secondary"
                  onClick={() => setEditingPlan(null)}
                  disabled={saving}
                >
                  Cancel
                </button>
                <button className="btn btn-primary" onClick={submitEdit} disabled={saving}>
                  {saving ? "Saving…" : "Save Changes"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
