import React from 'react';
import type { ReportRequest } from '../../lib/report/report-handler';

export default function ReportExportButton({ filters }: { filters: ReportRequest }) {
  const handleExport = () => {
    const params = new URLSearchParams(filters as unknown as Record<string, string>);
    params.set('format', 'csv');
    window.location.href = `?${params.toString()}`;
  };

  return (
    <button 
      onClick={handleExport}
      className="inline-flex items-center rounded-md bg-green-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-green-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green-600"
    >
      Export CSV
    </button>
  );
}
