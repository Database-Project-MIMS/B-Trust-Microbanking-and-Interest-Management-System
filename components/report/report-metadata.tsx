import type { ReportRequest } from "@/lib/report/report-handler";
export default function ReportMetadata({ generatedAt, requestedBy, filters, scopeLabel, agentLabel, sortLabels }: {
  generatedAt: string; requestedBy: string; filters?: ReportRequest; scopeLabel?: string; agentLabel?: string;
  /** Plain labels for this report's sort keys; defaults to RPT-01's. */
  sortLabels?: Record<string, string>;
}) {
  const generated = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Colombo", day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
  }).format(new Date(generatedAt));
  return <dl className="flex flex-wrap gap-4 text-sm text-[var(--text-muted)]">
    <div><dt>Generated · Asia/Colombo</dt><dd>{generated}</dd></div>
    <div><dt>Requested by</dt><dd>{requestedBy}</dd></div>
    {filters && <div><dt>Applied period · inclusive</dt><dd>{filters.from} to {filters.to}</dd></div>}
    {scopeLabel && <div><dt>Applied scope</dt><dd>{scopeLabel}</dd></div>}
    {agentLabel && <div><dt>Applied agent</dt><dd>{agentLabel}</dd></div>}
    {filters?.sort && <div><dt>Applied order</dt><dd>{
      (sortLabels ?? { employeeNo: "Employee number", agentName: "Agent name", netTotal: "Net movement" } as Record<string, string>)[filters.sort]
      ?? filters.sort} · {filters.direction === "desc" ? "Descending" : "Ascending"}</dd></div>}
    {filters?.pageSize && <div><dt>Rows per page</dt><dd>{filters.pageSize}</dd></div>}
  </dl>;
}
