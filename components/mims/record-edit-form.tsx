"use client";

import { useState, type FormEvent } from "react";
import { accountRequest, csrfToken } from "@/app/accounts/account-client";

export interface EditField {
  name: string; label: string; value: string; required?: boolean; maxLength?: number;
  type?: "text" | "email" | "tel" | "date" | "textarea";
  options?: { value: string; label: string }[]; nullable?: boolean;
}
type Patch = Record<string, string | null>;

/** Saves only changed fields through an existing CSRF-protected route; preserves drafts on failure. */
export function RecordEditForm({ title, description, endpoint, fields, onSaved, onCancel, buildPatch }: {
  title: string; description: string; endpoint: string; fields: EditField[];
  onSaved: () => void; onCancel: () => void; buildPatch?: (patch: Patch) => object;
}) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [pending, setPending] = useState<Patch | null>(null);
  async function persist(patch: Patch) {
    const token = csrfToken();
    if (!token) { setError("Sign in again before saving changes."); return; }
    setSaving(true); setError("");
    const response = await accountRequest(endpoint, { method: "PATCH",
      headers: { "Content-Type": "application/json", "x-csrf-token": token },
      body: JSON.stringify(buildPatch ? buildPatch(patch) : patch) });
    setSaving(false); setPending(null);
    if (response.ok) onSaved(); else setError(response.error?.message ?? "The changes could not be saved.");
  }
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    const form = new FormData(event.currentTarget);
    const patch: Patch = {};
    for (const field of fields) {
      const value = String(form.get(field.name) ?? "").trim();
      if (value !== field.value) patch[field.name] = value === "" && field.nullable ? null : value;
    }
    if (!Object.keys(patch).length) { setError("Change a field before saving."); return; }
    if (patch.status && ["INACTIVE", "SUSPENDED", "FROZEN"].includes(patch.status)) { setError(""); setPending(patch); return; }
    await persist(patch);
  }
  return <form className="card form-grid mt-6" onSubmit={save} aria-label={title}>
    <div><h2>{title}</h2><p className="muted mt-2">{description}</p></div>
    <fieldset disabled={saving || pending !== null} className="two-col">
      {fields.map(field => <label className="field" key={field.name}>
        {field.label}{field.required ? " (required)" : ""}
        {field.options ? <select className="input" name={field.name} defaultValue={field.value} required={field.required}>
          {field.options.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select> : field.type === "textarea" ? <textarea className="input min-h-24" name={field.name} defaultValue={field.value} required={field.required} maxLength={field.maxLength} /> :
          <input className="input" name={field.name} type={field.type ?? "text"} defaultValue={field.value} required={field.required} maxLength={field.maxLength} />}
      </label>)}
    </fieldset>
    {error && <p role="alert" className="text-[var(--danger)]">{error}</p>}
    {pending && <div className="confirmation-card" role="region" aria-label="Confirm status change">
      <p>Change this record to {pending.status}? This restricts its use. All edited fields will be saved together.</p>
      <div className="flex flex-wrap gap-3 mt-4"><button className="btn btn-secondary" disabled={saving} type="button" onClick={() => setPending(null)}>Keep editing</button>
        <button className="btn btn-primary" disabled={saving} type="button" onClick={() => void persist(pending)}>{saving ? "Saving…" : "Confirm changes"}</button></div>
    </div>}
    <div className="flex flex-wrap justify-end gap-3">
      <button className="btn btn-secondary" type="button" disabled={saving} onClick={onCancel}>Cancel</button>
      {!pending && <button className="btn btn-primary" type="submit" disabled={saving}>{saving ? "Saving…" : "Save changes"}</button>}
    </div>
  </form>;
}
