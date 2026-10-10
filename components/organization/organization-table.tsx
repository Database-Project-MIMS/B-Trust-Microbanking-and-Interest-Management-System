"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

type RecordStatus = "ACTIVE" | "INACTIVE" | "SUSPENDED";

interface Branch {
  branchId: string;
  branchCode: string;
  branchName: string;
  address: string;
  district: string;
  phone: string;
  status: RecordStatus;
}

interface Agent {
  agentId: string;
  username: string;
  branchId: string;
  branchCode: string;
  branchName: string;
  employeeNo: string;
  nicPassportNo: string;
  fullName: string;
  dateOfBirth: string;
  gender: string;
  phone: string;
  address: string;
  email: string;
  hiredDate: string;
  status: RecordStatus;
}

interface ApiError {
  error?: { message?: string };
}

interface OrganizationTableProps {
  resource: "agents" | "branches";
  roleName: string;
}

interface AgentDraft {
  branchId: string;
  username: string;
  password: string;
  employeeNo: string;
  nicPassportNo: string;
  fullName: string;
  dateOfBirth: string;
  gender: string;
  phone: string;
  address: string;
  email: string;
  hiredDate: string;
}

const emptyAgentDraft: AgentDraft = {
  branchId: "",
  username: "",
  password: "",
  employeeNo: "",
  nicPassportNo: "",
  fullName: "",
  dateOfBirth: "",
  gender: "",
  phone: "",
  address: "",
  email: "",
  hiredDate: "",
};

function readCsrfToken(): string {
  const item = document.cookie
    .split("; ")
    .find((value) => value.startsWith("mims_csrf="));
  return item?.split("=")[1] ?? "";
}

function statusClass(status: RecordStatus): string {
  if (status === "ACTIVE") return "status-pill status-completed";
  if (status === "SUSPENDED") return "status-pill status-pending";
  return "status-pill status-closed";
}

/** Manages branch and ordinary-agent records through the authorised organisation APIs. */
export function OrganizationTable({ resource, roleName }: OrganizationTableProps) {
  const router = useRouter();
  const confirmationRef = useRef<HTMLDivElement>(null);
  const [rows, setRows] = useState<Array<Branch | Agent>>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [statusFilter, setStatusFilter] = useState<"ACTIVE" | "ALL">("ACTIVE");
  const [refreshVersion, setRefreshVersion] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [pendingDeactivation, setPendingDeactivation] = useState<Branch | Agent | null>(null);
  const [agentDraft, setAgentDraft] = useState<AgentDraft>(emptyAgentDraft);

  const isBranch = resource === "branches";
  const canManage = isBranch
    ? roleName === "ADMIN"
    : roleName === "ADMIN" || roleName === "BRANCH_MANAGER";

  useEffect(() => {
    let active = true;

    async function load(): Promise<void> {
      setLoading(true);
      setError(null);
      try {
        const statusQuery = statusFilter === "ACTIVE" ? "?status=ACTIVE" : "";
        const requests: Promise<Response>[] = [fetch(`/api/${resource}${statusQuery}`)];
        if (!isBranch && canManage) requests.push(fetch("/api/branches?status=ACTIVE"));

        const responses = await Promise.all(requests);
        if (responses.some((response) => response.status === 401)) {
          router.replace(`/sign-in?next=/${resource}`);
          return;
        }

        const recordsResponse = responses[0];
        if (!recordsResponse?.ok) {
          const body = (await recordsResponse?.json()) as ApiError;
          throw new Error(body.error?.message ?? "The records could not be loaded.");
        }

        const recordsBody = (await recordsResponse.json()) as {
          data: Array<Branch | Agent>;
        };
        if (active) setRows(recordsBody.data);

        const branchesResponse = responses[1];
        if (branchesResponse) {
          if (!branchesResponse.ok) {
            const body = (await branchesResponse.json()) as ApiError;
            throw new Error(body.error?.message ?? "Active branches could not be loaded.");
          }
          const body = (await branchesResponse.json()) as { data: Branch[] };
          if (active) {
            setBranches(body.data);
            setAgentDraft((current) => ({
              ...current,
              branchId:
                current.branchId && body.data.some((branch) => branch.branchId === current.branchId)
                  ? current.branchId
                  : body.data[0]?.branchId ?? "",
            }));
          }
        }
      } catch (caught: unknown) {
        if (active) {
          setError(caught instanceof Error ? caught.message : "The records could not be loaded.");
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    void load();
    return () => {
      active = false;
    };
  }, [canManage, isBranch, refreshVersion, resource, router, statusFilter]);

  useEffect(() => {
    if (!pendingDeactivation) return;
    confirmationRef.current?.focus();
    function onKeyDown(event: KeyboardEvent): void {
      if (event.key === "Escape" && !saving) setPendingDeactivation(null);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [pendingDeactivation, saving]);

  function updateAgentDraft(field: keyof AgentDraft, value: string): void {
    setAgentDraft((current) => ({ ...current, [field]: value }));
  }

  async function sendMutation(path: string, method: "POST" | "PATCH", body: object): Promise<Response> {
    return fetch(path, {
      method,
      headers: {
        "content-type": "application/json",
        "x-csrf-token": readCsrfToken(),
      },
      body: JSON.stringify(body),
    });
  }

  async function handleCreateBranch(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    const formElement = event.currentTarget;
    setSaving(true);
    setError(null);
    setNotice(null);
    const form = new FormData(formElement);
    const body = {
      branchCode: String(form.get("branchCode") ?? "").trim(),
      branchName: String(form.get("branchName") ?? "").trim(),
      address: String(form.get("address") ?? "").trim(),
      district: String(form.get("district") ?? "").trim(),
      phone: String(form.get("phone") ?? "").trim(),
    };

    try {
      const response = await sendMutation("/api/branches", "POST", body);
      if (response.status === 401) {
        router.replace("/sign-in?next=/branches");
        return;
      }
      if (!response.ok) {
        const payload = (await response.json()) as ApiError;
        throw new Error(payload.error?.message ?? "The branch could not be created.");
      }
      formElement.reset();
      setShowCreateForm(false);
      setNotice(`Branch ${body.branchCode} was created.`);
      setStatusFilter("ACTIVE");
      setRefreshVersion((value) => value + 1);
    } catch (caught: unknown) {
      setError(caught instanceof Error ? caught.message : "The branch could not be created.");
    } finally {
      setSaving(false);
    }
  }

  async function handleCreateAgent(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setNotice(null);

    try {
      const response = await sendMutation("/api/agents", "POST", agentDraft);
      if (response.status === 401) {
        router.replace("/sign-in?next=/agents");
        return;
      }
      if (!response.ok) {
        const payload = (await response.json()) as ApiError;
        throw new Error(payload.error?.message ?? "The agent could not be created.");
      }
      setAgentDraft({ ...emptyAgentDraft, branchId: branches[0]?.branchId ?? "" });
      setShowCreateForm(false);
      setNotice(`Agent ${agentDraft.employeeNo} was created.`);
      setStatusFilter("ACTIVE");
      setRefreshVersion((value) => value + 1);
    } catch (caught: unknown) {
      setError(caught instanceof Error ? caught.message : "The agent could not be created.");
    } finally {
      setSaving(false);
    }
  }

  async function confirmDeactivation(): Promise<void> {
    if (!pendingDeactivation) return;
    setSaving(true);
    setError(null);
    setNotice(null);
    const id = isBranch
      ? (pendingDeactivation as Branch).branchId
      : (pendingDeactivation as Agent).agentId;

    try {
      const response = await sendMutation(`/api/${resource}/${id}`, "PATCH", {
        status: "INACTIVE",
      });
      if (response.status === 401) {
        router.replace(`/sign-in?next=/${resource}`);
        return;
      }
      if (!response.ok) {
        const payload = (await response.json()) as ApiError;
        throw new Error(payload.error?.message ?? `The ${isBranch ? "branch" : "agent"} could not be deactivated.`);
      }
      const label = isBranch
        ? (pendingDeactivation as Branch).branchCode
        : (pendingDeactivation as Agent).employeeNo;
      setPendingDeactivation(null);
      setNotice(`${isBranch ? "Branch" : "Agent"} ${label} was deactivated.`);
      setRefreshVersion((value) => value + 1);
    } catch (caught: unknown) {
      setPendingDeactivation(null);
      setError(
        caught instanceof Error
          ? caught.message
          : `The ${isBranch ? "branch" : "agent"} could not be deactivated.`,
      );
    } finally {
      setSaving(false);
    }
  }

  const branchRows = rows as Branch[];
  const agentRows = rows as Agent[];
  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="mt-6 space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <label className="field max-w-xs" htmlFor={`${resource}-status-filter`}>
          Status
          <select className="input" id={`${resource}-status-filter`} onChange={(event) => setStatusFilter(event.target.value as "ACTIVE" | "ALL")} value={statusFilter}>
            <option value="ACTIVE">Active only</option>
            <option value="ALL">All records</option>
          </select>
        </label>
        {canManage ? <button className="btn btn-primary" onClick={() => { setShowCreateForm((visible) => !visible); setError(null); setNotice(null); }} type="button">{showCreateForm ? "Close form" : `Create ${isBranch ? "branch" : "agent"}`}</button> : null}
      </div>

      {notice ? <p aria-live="polite" className="rounded-md border border-[var(--credit)] p-3 text-sm text-[var(--credit)]">{notice}</p> : null}
      {error ? <p aria-live="assertive" className="rounded-md border border-[var(--danger)] p-3 text-sm text-[var(--danger)]">{error}</p> : null}

      {showCreateForm && isBranch ? (
        <form className="card form-grid" onSubmit={handleCreateBranch}>
          <div><h2>Create branch</h2><p className="mt-1 text-sm text-[var(--text-muted)]">All fields are required. Branch codes cannot be changed after creation.</p></div>
          <div className="two-col">
            <label className="field" htmlFor="branch-code">Branch code (required)<input className="input" id="branch-code" maxLength={20} name="branchCode" required /></label>
            <label className="field" htmlFor="branch-name">Branch name (required)<input className="input" id="branch-name" maxLength={100} name="branchName" required /></label>
            <label className="field" htmlFor="branch-district">District (required)<input className="input" id="branch-district" maxLength={100} name="district" required /></label>
            <label className="field" htmlFor="branch-phone">Phone (required)<input className="input" id="branch-phone" maxLength={20} name="phone" required type="tel" /></label>
          </div>
          <label className="field" htmlFor="branch-address">Address (required)<textarea className="input min-h-24" id="branch-address" maxLength={255} name="address" required /></label>
          <div className="flex justify-end gap-3"><button className="btn btn-secondary" disabled={saving} onClick={() => setShowCreateForm(false)} type="button">Cancel</button><button className="btn btn-primary" disabled={saving} type="submit">{saving ? "Creating…" : "Create branch"}</button></div>
        </form>
      ) : null}

      {showCreateForm && !isBranch ? (
        <form className="card form-grid" onSubmit={handleCreateAgent}>
          <div><h2>Create ordinary agent</h2><p className="mt-1 text-sm text-[var(--text-muted)]">This creates an AGENT login and profile together. All fields are required.</p></div>
          <section className="form-section" aria-labelledby="agent-access-heading">
            <h2 id="agent-access-heading">Access</h2>
            <div className="two-col">
              <label className="field" htmlFor="agent-branch">Branch (required)<select className="input" disabled={roleName === "BRANCH_MANAGER"} id="agent-branch" onChange={(event) => updateAgentDraft("branchId", event.target.value)} required value={agentDraft.branchId}><option disabled value="">Select a branch</option>{branches.map((branch) => <option key={branch.branchId} value={branch.branchId}>{branch.branchCode} — {branch.branchName}</option>)}</select></label>
              <label className="field" htmlFor="agent-username">Username (required)<input autoComplete="off" className="input" id="agent-username" maxLength={100} minLength={3} onChange={(event) => updateAgentDraft("username", event.target.value)} pattern="[A-Za-z0-9._-]+" required value={agentDraft.username} /></label>
              <label className="field" htmlFor="agent-password">Temporary password (required)<input autoComplete="new-password" className="input" id="agent-password" maxLength={128} minLength={12} onChange={(event) => updateAgentDraft("password", event.target.value)} required type="password" value={agentDraft.password} /><small>Use at least 12 characters.</small></label>
            </div>
          </section>
          <section className="form-section" aria-labelledby="agent-identity-heading">
            <h2 id="agent-identity-heading">Identity and employment</h2>
            <div className="two-col">
              <label className="field" htmlFor="agent-employee-no">Employee number (required)<input className="input" id="agent-employee-no" maxLength={30} onChange={(event) => updateAgentDraft("employeeNo", event.target.value)} required value={agentDraft.employeeNo} /></label>
              <label className="field" htmlFor="agent-identity">NIC or passport number (required)<input className="input" id="agent-identity" maxLength={50} onChange={(event) => updateAgentDraft("nicPassportNo", event.target.value)} required value={agentDraft.nicPassportNo} /></label>
              <label className="field" htmlFor="agent-full-name">Full name (required)<input className="input" id="agent-full-name" maxLength={150} onChange={(event) => updateAgentDraft("fullName", event.target.value)} required value={agentDraft.fullName} /></label>
              <label className="field" htmlFor="agent-gender">Gender (required)<select className="input" id="agent-gender" onChange={(event) => updateAgentDraft("gender", event.target.value)} required value={agentDraft.gender}><option disabled value="">Select</option><option value="FEMALE">Female</option><option value="MALE">Male</option><option value="OTHER">Other</option></select></label>
              <label className="field" htmlFor="agent-date-of-birth">Date of birth (required)<input className="input" id="agent-date-of-birth" max={today} onChange={(event) => updateAgentDraft("dateOfBirth", event.target.value)} required type="date" value={agentDraft.dateOfBirth} /></label>
              <label className="field" htmlFor="agent-hired-date">Hired date (required)<input className="input" id="agent-hired-date" max={today} onChange={(event) => updateAgentDraft("hiredDate", event.target.value)} required type="date" value={agentDraft.hiredDate} /></label>
            </div>
          </section>
          <section className="form-section" aria-labelledby="agent-contact-heading">
            <h2 id="agent-contact-heading">Contact</h2>
            <div className="two-col">
              <label className="field" htmlFor="agent-email">Email (required)<input className="input" id="agent-email" maxLength={150} onChange={(event) => updateAgentDraft("email", event.target.value)} required type="email" value={agentDraft.email} /></label>
              <label className="field" htmlFor="agent-phone">Phone (required)<input className="input" id="agent-phone" maxLength={20} onChange={(event) => updateAgentDraft("phone", event.target.value)} required type="tel" value={agentDraft.phone} /></label>
            </div>
            <label className="field" htmlFor="agent-address">Address (required)<textarea className="input min-h-24" id="agent-address" maxLength={255} onChange={(event) => updateAgentDraft("address", event.target.value)} required value={agentDraft.address} /></label>
          </section>
          <div className="flex justify-end gap-3"><button className="btn btn-secondary" disabled={saving} onClick={() => setShowCreateForm(false)} type="button">Cancel</button><button className="btn btn-primary" disabled={saving || branches.length === 0} type="submit">{saving ? "Creating…" : "Create agent"}</button></div>
        </form>
      ) : null}

      {loading ? <p className="text-sm text-[var(--text-muted)]">Loading {resource}…</p> : (
        <div className="overflow-x-auto rounded-lg border border-[var(--border)] bg-[var(--surface)]">
          <table className="data-table min-w-[760px]">
            <thead><tr>{isBranch ? <><th>Code</th><th>Branch</th><th>District</th><th>Phone</th></> : <><th>Employee no.</th><th>Agent</th><th>Branch</th><th>Phone</th></>}<th>Status</th>{canManage ? <th className="text-right">Actions</th> : null}</tr></thead>
            <tbody>
              {isBranch ? branchRows.length ? branchRows.map((row) => <tr key={row.branchId}><td className="font-mono text-sm">{row.branchCode}</td><td className="font-medium">{row.branchName}</td><td>{row.district}</td><td>{row.phone}</td><td><span className={statusClass(row.status)}>{row.status}</span></td>{canManage ? <td className="text-right">{row.status === "ACTIVE" ? <button className="text-[var(--danger)] underline" onClick={() => setPendingDeactivation(row)} type="button">Deactivate</button> : <span className="text-[var(--text-muted)]">—</span>}</td> : null}</tr>) : <tr><td className="py-8 text-center text-[var(--text-muted)]" colSpan={canManage ? 6 : 5}>No branches match this status filter.</td></tr> : agentRows.length ? agentRows.map((row) => <tr key={row.agentId}><td className="font-mono text-sm">{row.employeeNo}</td><td><Link className="font-medium text-[var(--primary)] underline" href={`/agents/${row.agentId}/activity`} aria-label={`Daily activity for ${row.fullName}`}>{row.fullName}</Link><span className="block text-xs text-[var(--text-muted)]">{row.email}</span></td><td>{row.branchCode} — {row.branchName}</td><td>{row.phone}</td><td><span className={statusClass(row.status)}>{row.status}</span></td>{canManage ? <td className="text-right">{row.status === "ACTIVE" ? <button className="text-[var(--danger)] underline" onClick={() => setPendingDeactivation(row)} type="button">Deactivate</button> : <span className="text-[var(--text-muted)]">—</span>}</td> : null}</tr>) : <tr><td className="py-8 text-center text-[var(--text-muted)]" colSpan={canManage ? 6 : 5}>No agents match this status filter.</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {pendingDeactivation ? <div className="fixed inset-0 z-20 flex items-center justify-center bg-black/40 p-4" role="presentation"><div aria-describedby="deactivate-description" aria-labelledby="deactivate-title" aria-modal="true" className="card w-full max-w-md" ref={confirmationRef} role="dialog" tabIndex={-1}><h2 id="deactivate-title">Confirm deactivation</h2><p className="mt-3 text-sm text-[var(--text-muted)]" id="deactivate-description">Deactivate <strong>{isBranch ? (pendingDeactivation as Branch).branchName : (pendingDeactivation as Agent).fullName}</strong>? The record will remain in history and will not be deleted.</p><div className="mt-6 flex justify-end gap-3"><button className="btn btn-secondary" disabled={saving} onClick={() => setPendingDeactivation(null)} type="button">Cancel</button><button className="btn btn-primary" disabled={saving} onClick={confirmDeactivation} type="button">{saving ? "Deactivating…" : "Confirm deactivation"}</button></div></div></div> : null}
    </div>
  );
}
