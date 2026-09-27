"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type Branch = { branchId: string; branchCode: string; branchName: string; district: string; phone: string; status: string };
type Agent = { agentId: string; employeeNo: string; fullName: string; branchCode: string; branchName: string; phone: string; status: string };
type ApiError = { error?: { message?: string } };

interface OrganizationTableProps { resource: "agents" | "branches" }

/** Loads the current caller's branch-scoped organisation data from its authorised API. */
export function OrganizationTable({ resource }: OrganizationTableProps) {
  const router = useRouter();
  const [rows, setRows] = useState<Branch[] | Agent[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    async function load(): Promise<void> {
      setLoading(true); setError(null);
      try {
        const response = await fetch(`/api/${resource}`);
        if (response.status === 401) { router.replace(`/sign-in?next=/${resource}`); return; }
        if (!response.ok) { const body = (await response.json()) as ApiError; throw new Error(body.error?.message ?? "The data could not be loaded."); }
        const body = (await response.json()) as { data: Branch[] | Agent[] };
        if (active) setRows(body.data);
      } catch (caught: unknown) {
        if (active) setError(caught instanceof Error ? caught.message : "The data could not be loaded.");
      } finally { if (active) setLoading(false); }
    }
    void load();
    return () => { active = false; };
  }, [resource, router]);

  if (loading) return <p className="mt-6 text-sm text-[var(--text-muted)]">Loading {resource}…</p>;
  if (error) return <p aria-live="polite" className="mt-6 rounded-md border border-[var(--danger)] p-3 text-sm text-[var(--danger)]">{error}</p>;

  const isBranch = resource === "branches";
  const branchRows = rows as Branch[];
  const agentRows = rows as Agent[];
  return <div className="mt-6 overflow-x-auto rounded-lg border border-[var(--border)] bg-[var(--surface)]"><table className="data-table"><thead><tr>{isBranch ? <><th>Code</th><th>Branch</th><th>District</th><th>Phone</th></> : <><th>Employee no.</th><th>Agent</th><th>Branch</th><th>Phone</th></>}<th>Status</th></tr></thead><tbody>{isBranch ? branchRows.length ? branchRows.map((row) => <tr key={row.branchId}><td>{row.branchCode}</td><td className="font-medium">{row.branchName}</td><td>{row.district}</td><td>{row.phone}</td><td>{row.status}</td></tr>) : <tr><td className="py-8 text-center text-[var(--text-muted)]" colSpan={5}>No branches are available in your scope.</td></tr> : agentRows.length ? agentRows.map((row) => <tr key={row.agentId}><td>{row.employeeNo}</td><td className="font-medium">{row.fullName}</td><td>{row.branchCode} — {row.branchName}</td><td>{row.phone}</td><td>{row.status}</td></tr>) : <tr><td className="py-8 text-center text-[var(--text-muted)]" colSpan={5}>No agents are available in your scope.</td></tr>}</tbody></table></div>;
}
