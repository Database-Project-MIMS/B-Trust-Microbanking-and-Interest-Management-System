"use client";

import { useId, useState } from "react";
import type { CustomerSearchResult } from "@/services/customer-service";
import { accountRequest } from "../account-client";
import { displayDate } from "../account-format";
import type { HolderChoice } from "./account-opening-model";

/** Searches customers the signed-in user may see (the customer API applies agent assignment) and lets the user pick one. */
export function CustomerPicker({ label, actionLabel, excludeIds, disabled, onPick }: {
  label: string; actionLabel: string; excludeIds: string[]; disabled?: boolean; onPick: (holder: HolderChoice) => void;
}) {
  const inputId = useId();
  const [text, setText] = useState("");
  const [result, setResult] = useState<CustomerSearchResult | null>(null);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState("");

  async function search() {
    const q = text.trim();
    if (!q) { setError("Enter a name, customer number or identity to search."); return; }
    setSearching(true); setError("");
    const response = await accountRequest<CustomerSearchResult>(`/api/customers?q=${encodeURIComponent(q)}&pageSize=10&status=ACTIVE`);
    setSearching(false);
    if (!response.ok || !response.data) { setResult(null); setError(response.error?.message ?? "Customer search failed."); return; }
    setResult(response.data);
  }

  return <div className="form-section">
    <label className="field" htmlFor={inputId}>{label}
      <span className="flex gap-2">
        <input id={inputId} className="input" value={text} maxLength={150} disabled={disabled} placeholder="Name, customer number or identity"
          onChange={event => setText(event.target.value)}
          onKeyDown={event => { if (event.key === "Enter") { event.preventDefault(); void search(); } }} />
        <button className="btn btn-secondary" type="button" disabled={disabled || searching} onClick={() => void search()}>{searching ? "Searching…" : "Search"}</button>
      </span>
    </label>
    {error && <p role="alert" className="text-[var(--danger)]">{error}</p>}
    {result && <div className="table-wrap" aria-live="polite">
      <table className="data-table"><thead><tr><th>Name</th><th>Customer number</th><th>Identity</th><th>Date of birth</th><th><span className="sr-only">Action</span></th></tr></thead>
        <tbody>
          {result.customers.map(customer => {
            const chosen = excludeIds.includes(customer.customerId);
            return <tr key={customer.customerId}>
              <td>{customer.fullName}</td><td>{customer.customerNumber}</td><td>{customer.nicPassportNo}</td><td>{displayDate(customer.dateOfBirth)}</td>
              <td><button className="btn btn-secondary" type="button" disabled={disabled || chosen}
                aria-label={`${actionLabel} ${customer.fullName}`}
                onClick={() => onPick({ customerId: customer.customerId, customerNumber: customer.customerNumber, fullName: customer.fullName, dateOfBirth: customer.dateOfBirth })}>
                {chosen ? "Added" : actionLabel}</button></td>
            </tr>;
          })}
          {!result.customers.length && <tr><td colSpan={5}>No customers match. Agents see only customers assigned to them.</td></tr>}
        </tbody></table></div>}
  </div>;
}
