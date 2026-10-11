"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { accountRequest } from "@/app/accounts/account-client";
import { displayDate } from "@/app/accounts/account-format";
import { RecordDetails } from "@/components/mims/record-details";
import { RecordEditForm, type EditField } from "@/components/mims/record-edit-form";

interface Branch { branchId: string; branchCode: string; branchName: string; district: string; phone: string;
  address: string; status: string; createdAt: string; updatedAt: string }
interface Agent { agentId: string; username: string; branchId: string; branchCode: string; branchName: string;
  employeeNo: string; nicPassportNo: string; fullName: string; dateOfBirth: string; gender: string; phone: string;
  address: string; email: string; hiredDate: string; status: string; createdAt: string; updatedAt: string }
const statuses = ["ACTIVE", "INACTIVE", "SUSPENDED"].map(value => ({ value, label: value }));

export function OrganizationDetail({ resource, id, canEdit, editing }: {
  resource: "branches" | "agents"; id: string; canEdit: boolean; editing: boolean;
}) {
  const router = useRouter();
  const [record, setRecord] = useState<Branch | Agent | null>(null);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const [notice, setNotice] = useState("");
  const href = `/${resource}/${encodeURIComponent(id)}`;
  useEffect(() => {
    const controller = new AbortController(); setRecord(null); setError("");
    accountRequest<Branch | Agent>(`/api${href}`, { signal: controller.signal }).then(response => {
      if (controller.signal.aborted) return;
      if (response.ok && response.data) setRecord(response.data);
      else setError(response.error?.message ?? "Unable to load the record.");
    }).catch(() => { if (!controller.signal.aborted) setError("Unable to load the record."); });
    return () => controller.abort();
  }, [href, attempt]);
  const isBranch = resource === "branches";
  const branch = record as Branch | null;
  const agent = record as Agent | null;
  const title = record ? isBranch ? branch!.branchName : agent!.fullName : isBranch ? "Branch details" : "Agent details";
  const items = record ? isBranch ? [
    { label: "Branch code", value: branch!.branchCode }, { label: "Branch name", value: branch!.branchName },
    { label: "District", value: branch!.district }, { label: "Phone", value: branch!.phone },
    { label: "Address", value: branch!.address },
  ] : [
    { label: "Employee number", value: agent!.employeeNo }, { label: "Full name", value: agent!.fullName },
    { label: "Username", value: agent!.username }, { label: "NIC / passport number", value: agent!.nicPassportNo },
    { label: "Date of birth", value: displayDate(agent!.dateOfBirth) }, { label: "Gender", value: agent!.gender },
    { label: "Hired date", value: displayDate(agent!.hiredDate) }, { label: "Email", value: agent!.email },
    { label: "Phone", value: agent!.phone }, { label: "Address", value: agent!.address },
    { label: "Branch", value: <Link href={`/branches/${agent!.branchId}`}>{agent!.branchCode} — {agent!.branchName}</Link> },
  ] : [];
  const fields: EditField[] = record ? isBranch ? [
    { name: "branchName", label: "Branch name", value: branch!.branchName, required: true, maxLength: 100 },
    { name: "district", label: "District", value: branch!.district, required: true, maxLength: 100 },
    { name: "phone", label: "Phone", value: branch!.phone, type: "tel", required: true, maxLength: 20 },
    { name: "address", label: "Address", value: branch!.address, type: "textarea", required: true, maxLength: 255 },
  ] : [
    { name: "fullName", label: "Full name", value: agent!.fullName, required: true, maxLength: 150 },
    { name: "employeeNo", label: "Employee number", value: agent!.employeeNo, required: true, maxLength: 30 },
    { name: "nicPassportNo", label: "NIC / passport number", value: agent!.nicPassportNo, required: true, maxLength: 50 },
    { name: "dateOfBirth", label: "Date of birth", value: agent!.dateOfBirth, type: "date", required: true },
    { name: "gender", label: "Gender", value: agent!.gender, required: true,
      options: [...new Set([agent!.gender, "MALE", "FEMALE", "OTHER"])].map(value => ({ value, label: value })) },
    { name: "hiredDate", label: "Hired date", value: agent!.hiredDate, type: "date", required: true },
    { name: "email", label: "Email", value: agent!.email, type: "email", required: true, maxLength: 150 },
    { name: "phone", label: "Phone", value: agent!.phone, type: "tel", required: true, maxLength: 20 },
    { name: "address", label: "Address", value: agent!.address, type: "textarea", required: true, maxLength: 255 },
  ] : [];
  if (record) fields.push({ name: "status", label: "Status", value: record.status, options: statuses, required: true });
  return <>
    <div className="page-header"><div><p className="eyebrow">Organisation</p><h1 className="page-title">{title}</h1></div>
      <div className="flex flex-wrap gap-2">
        {record && canEdit && !editing && <Link className="btn btn-secondary" href={`${href}?edit=1`}>Edit</Link>}
        {record && !isBranch && <Link className="btn btn-secondary" href={`${href}/activity`}>View daily activity</Link>}
        <Link className="btn btn-secondary" href={`/${resource}`}>Back to {resource}</Link>
      </div>
    </div>
    {notice && <p role="status" className="card mt-6">{notice}</p>}
    {error ? <div role="alert" className="card mt-6"><p>{error}</p><button className="btn btn-secondary" onClick={() => setAttempt(value => value + 1)}>Retry</button></div> :
      !record ? <p role="status" className="card mt-6">Loading details…</p> : <>
        <section className="card mt-6"><h2>{isBranch ? "Branch information" : "Agent information"}</h2>
          <RecordDetails items={[...items, { label: "Status", value: record.status },
            { label: "Created", value: displayDate(record.createdAt) }, { label: "Last updated", value: displayDate(record.updatedAt) }]} />
        </section>
        {canEdit && editing && <RecordEditForm key={attempt} title={`Edit ${isBranch ? "branch" : "agent"}`}
          description={isBranch ? "The branch code stays fixed. Deactivation is rejected while active staff exist." : "Login and branch remain unchanged. An inactive or suspended status also disables this agent's login."}
          endpoint={`/api${href}`} fields={fields} onCancel={() => router.replace(href)}
          onSaved={() => { setNotice("Changes saved."); router.replace(href); setAttempt(value => value + 1); }} />}
      </>}
  </>;
}
