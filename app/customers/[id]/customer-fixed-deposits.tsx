"use client";

import { useEffect, useState } from "react";
import type { CustomerFixedDeposits } from "@/types/customer-fixed-deposit";
import { customerRequest, displayDate, displayMoney } from "../customer-client";

/** Formats a stored fractional rate exactly, without floating-point arithmetic. */
export function displaySnapshotRate(value: string): string {
  const [whole, fraction = ""] = value.split(".");
  const digits = `${whole}${fraction.padEnd(4, "0").slice(0, 4)}`;
  return `${digits.slice(0, -2).replace(/^0+(?=\d)/, "")}.${digits.slice(-2)}%`;
}

export function CustomerFixedDepositsPanel({ customerId }: { customerId: string }) {
  const [result, setResult] = useState<CustomerFixedDeposits | null>(null);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setResult(null); setError("");
    customerRequest<CustomerFixedDeposits>(`/api/customers/${encodeURIComponent(customerId)}/fixed-deposits`,
      { signal: controller.signal })
      .then(data => { if (!controller.signal.aborted) setResult(data); })
      .catch(cause => { if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "Unable to load fixed deposits."); });
    return () => controller.abort();
  }, [customerId, attempt]);
  return <section className="card mt-6 min-w-0" aria-labelledby="customer-fd-heading">
    <h2 id="customer-fd-heading" className="section-heading">Fixed Deposits</h2>
    <p className="page-description">Deposits linked through this customer’s savings accounts. Rates are fixed at opening.</p>
    {error ? <div role="alert" className="mt-4"><p>{error}</p>
      <button type="button" className="btn btn-secondary mt-4" onClick={() => setAttempt(value => value + 1)}>Retry fixed deposits</button>
    </div> : !result ? <p role="status" className="mt-4">Loading fixed deposits…</p>
      : !result.fixedDeposits.length ? <p role="status" className="mt-4">No fixed deposits linked to this customer.</p>
        : <div className="table-wrap mt-4"><table className="data-table">
          <caption className="sr-only">Customer fixed deposits, newest opening date first</caption>
          <thead><tr><th scope="col">Savings account</th><th scope="col">Product</th><th scope="col">Principal</th>
            <th scope="col">Rate at opening</th><th scope="col">Opened</th><th scope="col">Maturity</th>
            <th scope="col">Next interest</th><th scope="col">Status</th></tr></thead>
          <tbody>{result.fixedDeposits.map(fd => <tr key={fd.fdId}>
            <th scope="row" className="font-normal">{fd.accountNumber}</th><td>{fd.planName}</td>
            <td className="amount whitespace-nowrap">{displayMoney(fd.principalAmount)}</td>
            <td className="amount">{displaySnapshotRate(fd.interestRateAtOpening)}</td>
            <td className="whitespace-nowrap">{displayDate(fd.startDate)}</td>
            <td className="whitespace-nowrap">{displayDate(fd.maturityDate)}</td>
            <td className="whitespace-nowrap">{displayDate(fd.nextInterestDate)}</td>
            <td><span className="status-pill">{fd.status}</span></td>
          </tr>)}</tbody>
        </table></div>}
  </section>;
}
