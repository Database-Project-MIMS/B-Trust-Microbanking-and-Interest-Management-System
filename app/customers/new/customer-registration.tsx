"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { csrfToken, customerRequest } from "../customer-client";

export function CustomerRegistration({ branchId, agents }: { branchId: string; agents: { agentId: string; fullName: string }[] }) {
  const router = useRouter();
  const [documents, setDocuments] = useState<{ docType: string; filePath: string }[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  return <>
    <div className="page-header"><div><p className="eyebrow">Customers</p><h1 className="page-title">Register customer</h1></div><Link className="btn btn-secondary" href="/customers">Back to search</Link></div>
    <form className="card form-grid mt-6" onSubmit={async event => {
      event.preventDefault(); if (saving) return;
      const fields = new FormData(event.currentTarget);
      const input = Object.fromEntries(fields);
      for (const key of ["phone", "gender", "address"]) { if (!input[key]) delete input[key]; }
      setSaving(true); setError("");
      try {
        const token = csrfToken();
        if (!token) throw new Error("Your security token is missing. Sign in again before registering.");
        const result = await customerRequest<{ customerId: string }>("/api/customers", { method: "POST", headers: { "Content-Type": "application/json", "x-csrf-token": token }, body: JSON.stringify({ ...input, branchId, documents }) });
        router.push(`/customers/${result.customerId}`);
      } catch (error) { setError(error instanceof Error ? error.message : "Registration failed."); setSaving(false); }
    }}>
      <fieldset disabled={saving} className="form-section"><legend className="section-heading">Customer identity</legend><div className="two-col">
        <label className="field">Full name *<input className="input" name="fullName" required maxLength={150} /></label>
        <label className="field">NIC or passport *<input className="input" name="nicPassportNo" required minLength={5} maxLength={50} /></label>
        <label className="field">Date of birth *<input className="input" name="dateOfBirth" type="date" required /></label>
        <label className="field">Email *<input className="input" name="email" type="email" required maxLength={150} /></label>
        <label className="field">Gender<input className="input" name="gender" maxLength={20} /></label>
        <label className="field">Phone<input className="input" name="phone" type="tel" maxLength={20} /></label>
        <label className="field">Address<input className="input" name="address" maxLength={255} /></label>
        <label className="field">Assigned agent *<select className="input" name="agentId" required><option value="">Select agent</option>{agents.map(agent => <option key={agent.agentId} value={agent.agentId}>{agent.fullName}</option>)}</select></label>
      </div><p className="muted">Registration uses your assigned branch. Required fields are marked *.</p></fieldset>
      <fieldset disabled={saving} className="form-section"><legend className="section-heading">Document references</legend>
        <p className="muted">Add references to documents already stored by the bank. Registration does not upload files or verify documents.</p>
        {documents.map((doc, index) => <div className="two-col" key={index}>
          <label className="field">Document type *<input className="input" required maxLength={50} value={doc.docType} onChange={event => setDocuments(rows => rows.map((row, i) => i === index ? { ...row, docType: event.target.value } : row))} /></label>
          <label className="field">Stored document reference *<input className="input" required maxLength={500} value={doc.filePath} onChange={event => setDocuments(rows => rows.map((row, i) => i === index ? { ...row, filePath: event.target.value } : row))} /></label>
          <button className="btn btn-secondary" type="button" aria-label={`Remove document ${index + 1}`} onClick={() => setDocuments(rows => rows.filter((_, i) => i !== index))}>Remove document {index + 1}</button>
        </div>)}
        <button className="btn btn-secondary" type="button" disabled={documents.length >= 20} onClick={() => setDocuments(rows => [...rows, { docType: "", filePath: "" }])}>Add document reference</button>
      </fieldset>
      {error && <p role="alert" className="text-[var(--danger)]">{error}</p>}
      {!agents.length && <p role="alert">No active agents are available in your branch.</p>}
      <button className="btn btn-primary" type="submit" disabled={saving || !agents.length}>{saving ? "Registering customer…" : "Register customer"}</button>
    </form>
  </>;
}
