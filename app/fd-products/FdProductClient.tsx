"use client";

import type { ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { FdProduct } from "@/services/fd-product-service";

interface FdProductClientProps {
  initialProducts: FdProduct[];
  isAdmin: boolean;
}

type PendingChange =
  | { kind: "rate"; product: FdProduct; interestRate: string }
  | { kind: "deactivate"; product: FdProduct };

interface ApiError { error?: { message?: string } }

function readCsrfToken(): string {
  const item = document.cookie.split("; ").find((value) => value.startsWith("mims_csrf="));
  return item?.split("=")[1] ?? "";
}

function formatRate(rate: string): string {
  if (!/^\d+(?:\.\d+)?$/.test(rate)) return "—";
  const [whole = "0", decimal = ""] = rate.split(".");
  const basisPoints = BigInt(whole) * 10000n + BigInt(`${decimal}0000`.slice(0, 4));
  return `${basisPoints / 100n}.${(basisPoints % 100n).toString().padStart(2, "0")}%`;
}

function formatDate(value: Date | string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) return "—";
  return new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric", timeZone: "Asia/Colombo" }).format(date);
}

/** Displays FD product history and posts confirmed administration changes through the API. */
export default function FdProductClient({ initialProducts, isAdmin }: FdProductClientProps) {
  const router = useRouter();
  const [products, setProducts] = useState(initialProducts);
  const [editing, setEditing] = useState<FdProduct | null>(null);
  const [interestRate, setInterestRate] = useState("");
  const [pendingChange, setPendingChange] = useState<PendingChange | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!pendingChange) return;
    dialogRef.current?.focus();
    function onKeyDown(event: KeyboardEvent): void { if (event.key === "Escape" && !isSaving) setPendingChange(null); }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [pendingChange, isSaving]);

  const activeProducts = products.filter((product) => product.status === "ACTIVE" && product.effectiveTo === null);
  const historicalProducts = products.filter((product) => product.status !== "ACTIVE" || product.effectiveTo !== null);

  function startEdit(product: FdProduct): void { setEditing(product); setInterestRate(product.interestRate); setError(null); setNotice(null); }
  function requestRateChange(): void {
    if (!editing) return;
    if (!/^0\.(?=.*[1-9])\d{1,4}$|^1(?:\.0{1,4})?$/.test(interestRate)) { setError("Interest rate must be greater than 0 and no more than 1, with up to four decimal places."); return; }
    setPendingChange({ kind: "rate", product: editing, interestRate });
  }

  async function confirmChange(): Promise<void> {
    if (!pendingChange) return;
    setIsSaving(true); setError(null);
    const body = pendingChange.kind === "rate" ? { interestRate: pendingChange.interestRate } : { status: "INACTIVE" };
    try {
      const response = await fetch(`/api/fd-products/${pendingChange.product.fdPlanId}`, { method: "PATCH", headers: { "content-type": "application/json", "x-csrf-token": readCsrfToken() }, body: JSON.stringify(body) });
      if (response.status === 401) { router.replace("/sign-in?next=/fd-products"); return; }
      if (!response.ok) { const payload = (await response.json()) as ApiError; throw new Error(payload.error?.message ?? "The product could not be updated."); }
      const payload = (await response.json()) as { data: FdProduct };
      if (pendingChange.kind === "rate") setProducts((current) => [...current.map((product) => product.fdPlanId === pendingChange.product.fdPlanId ? { ...product, status: "INACTIVE", effectiveTo: new Date().toISOString() } : product), payload.data]);
      else setProducts((current) => current.map((product) => product.fdPlanId === pendingChange.product.fdPlanId ? payload.data : product));
      setNotice(pendingChange.kind === "rate" ? "The new rate was saved with its effective-date history." : "The product was deactivated.");
      setEditing(null); setPendingChange(null);
    } catch (caught: unknown) {
      setError(caught instanceof Error ? caught.message : "The product could not be updated.");
      setPendingChange(null);
    } finally { setIsSaving(false); }
  }

  function renderTable(list: FdProduct[], history: boolean): ReactNode {
    return <div className="mt-3 overflow-x-auto rounded-lg border border-[var(--border)] bg-[var(--surface)]"><table className="data-table"><thead><tr><th>Plan name</th><th>Tenure</th><th className="text-right">Interest rate</th><th>Status</th><th>Effective from</th><th>Effective to</th>{!history && isAdmin ? <th className="text-right">Actions</th> : null}</tr></thead><tbody>{list.length ? list.map((product) => <tr key={product.fdPlanId}><td className="font-medium">{product.planName}</td><td>{product.tenureMonths} months</td><td className="amount text-[var(--credit)]">{formatRate(product.interestRate)}</td><td>{product.status}</td><td>{formatDate(product.effectiveFrom)}</td><td>{formatDate(product.effectiveTo)}</td>{!history && isAdmin ? <td className="amount"><button className="mr-3 text-[var(--primary)] underline" onClick={() => startEdit(product)} type="button">Edit rate</button><button className="text-[var(--danger)] underline" onClick={() => { setPendingChange({ kind: "deactivate", product }); setNotice(null); }} type="button">Deactivate</button></td> : null}</tr>) : <tr><td className="py-8 text-center text-[var(--text-muted)]" colSpan={isAdmin && !history ? 7 : 6}>No products found.</td></tr>}</tbody></table></div>;
  }

  return <div className="mt-8 space-y-8">
    {notice ? <p aria-live="polite" className="rounded-md border border-[var(--credit)] p-3 text-sm text-[var(--credit)]">{notice}</p> : null}
    {error ? <p aria-live="polite" className="rounded-md border border-[var(--danger)] p-3 text-sm text-[var(--danger)]">{error}</p> : null}
    {editing ? <section className="card max-w-lg" aria-labelledby="edit-rate-title"><h2 className="text-lg font-semibold" id="edit-rate-title">Edit rate: {editing.planName}</h2><p className="mt-2 text-sm text-[var(--text-muted)]">Rate changes create a new effective-dated product record.</p><label className="mt-4 block text-[13px] font-medium text-[var(--text-muted)]" htmlFor="interest-rate">New interest rate (fraction)</label><input aria-describedby="rate-help" className="input mt-1" id="interest-rate" onChange={(event) => setInterestRate(event.target.value)} value={interestRate} /><p className="mt-1 text-xs text-[var(--text-muted)]" id="rate-help">For example, enter 0.1250 for 12.50%.</p><div className="mt-4 flex gap-3"><button className="btn btn-secondary" onClick={() => setEditing(null)} type="button">Cancel</button><button className="btn btn-primary" onClick={requestRateChange} type="button">Review change</button></div></section> : null}
    <section><h2 className="section-heading">Active products</h2>{renderTable(activeProducts, false)}</section>
    <section><h2 className="section-heading">Rate history and inactive products</h2>{renderTable(historicalProducts, true)}</section>
    {pendingChange ? <div className="fixed inset-0 z-20 flex items-center justify-center bg-black/40 p-4" role="presentation"><div aria-describedby="change-description" aria-labelledby="change-title" aria-modal="true" className="card w-full max-w-md" ref={dialogRef} role="dialog" tabIndex={-1}><h2 className="text-lg font-semibold" id="change-title">Confirm product change</h2><p className="mt-3 text-sm text-[var(--text-muted)]" id="change-description">{pendingChange.kind === "rate" ? <>Create a new rate of <strong>{formatRate(pendingChange.interestRate)}</strong> for <strong>{pendingChange.product.planName}</strong>. The current rate will move to history.</> : <>Deactivate <strong>{pendingChange.product.planName}</strong>. It will remain available in the product history.</>}</p><div className="mt-6 flex justify-end gap-3"><button className="btn btn-secondary" disabled={isSaving} onClick={() => setPendingChange(null)} type="button">Cancel</button><button className="btn btn-primary" disabled={isSaving} onClick={confirmChange} type="button">{isSaving ? "Saving…" : "Confirm"}</button></div></div></div> : null}
  </div>;
}
