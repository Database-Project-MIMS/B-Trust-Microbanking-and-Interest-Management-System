"use client";
import type { ReactNode } from "react";
import ReportFilters from "./report-filters";
import ReportTable, { type ReportColumn } from "./report-table";
import ReportMetadata from "./report-metadata";
import ReportExportButton from "./report-export-button";
import type { ReportRequest, ReportResult } from "@/lib/report/report-handler";

interface ReportShellProps<T> {
  title: string; filters: ReportRequest; onFilterChange: (filters: ReportRequest) => void;
  onApply?: () => void; result?: ReportResult<T>; loading?: boolean; endpoint?: string;
  branches?: { id: string; name: string }[]; agents?: { id: string; name: string }[];
  branchLocked?: boolean; columns?: ReportColumn<T>[]; rowKey?: (row: T) => string;
  scopeLabel?: string; agentLabel?: string; reportCode?: string; filterExtras?: ReactNode; children?: ReactNode;
}
export default function ReportShell<T>(props: ReportShellProps<T>) {
  return <div className="space-y-6 min-w-0">
    <div className="page-header flex flex-wrap items-center justify-between gap-4">
      <div><p className="eyebrow">{props.reportCode ? props.reportCode + " · " : ""}Management reports</p><h1 className="page-title">{props.title}</h1></div>
      {props.result && <ReportExportButton filters={props.result.filters} endpoint={props.endpoint} disabled={props.loading} />}
    </div>
    <section className="card"><ReportFilters filters={props.filters} onChange={props.onFilterChange}
      onApply={props.onApply} disabled={props.loading} branches={props.branches} agents={props.agents}
      branchLocked={props.branchLocked}>{props.filterExtras}</ReportFilters></section>
    {props.children}
    {props.loading ? <div className="card" role="status">Generating report…</div> : props.result
      ? <section className="card min-w-0 space-y-4">
        <ReportMetadata generatedAt={props.result.generatedAt} requestedBy={props.result.requestedBy}
          filters={props.result.filters} scopeLabel={props.scopeLabel} agentLabel={props.agentLabel} />
        <ReportTable result={props.result} columns={props.columns} rowKey={props.rowKey} />
      </section> : null}
  </div>;
}
