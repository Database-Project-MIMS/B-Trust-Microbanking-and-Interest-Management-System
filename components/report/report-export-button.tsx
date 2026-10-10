"use client";
import type { ReportRequest } from "@/lib/report/report-handler";
export default function ReportExportButton({ filters, endpoint, disabled }: {
  filters: ReportRequest; endpoint?: string; disabled?: boolean;
}) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) if (value !== undefined) params.set(key, String(value));
  params.set("format", "csv");
  return <button type="button" className="btn btn-secondary" disabled={disabled || !endpoint}
    onClick={() => { if (endpoint) window.location.assign(endpoint + "?" + params.toString()); }}>
    Export CSV · all filtered rows
  </button>;
}
