"use client";
import { useId, type ReactNode } from "react";
import type { ReportRequest } from "@/lib/report/report-handler";
export default function ReportFilters({ filters, onChange, onApply, disabled, branches, agents, branchLocked, children }: {
  filters: ReportRequest; onChange: (filters: ReportRequest) => void; onApply?: () => void; disabled?: boolean;
  branches?: { id: string; name: string }[]; agents?: { id: string; name: string }[]; branchLocked?: boolean; children?: ReactNode;
}) {
  const id = useId();
  return <form onSubmit={event => { event.preventDefault(); onApply?.(); }} className="space-y-4">
    <fieldset disabled={disabled} className="two-col">
      <label className="field" htmlFor={id + "-from"}>From · Asia/Colombo
        <input id={id + "-from"} className="input" type="date" required value={filters.from ?? ""}
          onChange={event => onChange({ ...filters, from: event.target.value })} /></label>
      <label className="field" htmlFor={id + "-to"}>To · inclusive
        <input id={id + "-to"} className="input" type="date" required min={filters.from} value={filters.to ?? ""}
          onChange={event => onChange({ ...filters, to: event.target.value })} /></label>
      {branches && <label className="field" htmlFor={id + "-branch"}>Posting branch
        <select id={id + "-branch"} className="input" disabled={branchLocked} value={filters.branchId ?? ""}
          onChange={event => onChange({ ...filters, branchId: event.target.value || undefined, agentId: undefined })}>
          {!branchLocked && <option value="">All posting branches</option>}
          {branches.map(branch => <option key={branch.id} value={branch.id}>{branch.name}</option>)}</select></label>}
      {agents && <label className="field" htmlFor={id + "-agent"}>Agent · includes historical profiles
        <select id={id + "-agent"} className="input" value={filters.agentId ?? ""}
          onChange={event => onChange({ ...filters, agentId: event.target.value || undefined })}>
          <option value="">All eligible agents</option>
          {agents.map(agent => <option key={agent.id} value={agent.id}>{agent.name}</option>)}</select></label>}
      {children}
    </fieldset>
    <button type="submit" className="btn btn-primary" disabled={disabled}>Apply filters</button>
  </form>;
}
