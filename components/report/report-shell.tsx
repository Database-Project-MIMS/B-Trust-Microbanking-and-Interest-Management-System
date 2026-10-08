import React from 'react';
import ReportFilters from './report-filters';
import ReportTable from './report-table';
import ReportMetadata from './report-metadata';
import ReportExportButton from './report-export-button';
import type { ReportRequest, ReportResult } from '../../lib/report/report-handler';

interface ReportShellProps<T> {
  title: string;
  filters: ReportRequest;
  onFilterChange: (filters: ReportRequest) => void;
  result?: ReportResult<T>;
  loading?: boolean;
}

export default function ReportShell<T>({
  title,
  filters,
  onFilterChange,
  result,
  loading
}: ReportShellProps<T>) {
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">{title}</h1>
        {result && <ReportExportButton filters={filters} />}
      </div>
      
      <div className="bg-white p-4 rounded shadow-sm border border-gray-200">
        <ReportFilters filters={filters} onChange={onFilterChange} disabled={loading} />
      </div>

      {loading ? (
        <div className="flex justify-center p-8">Loading...</div>
      ) : result ? (
        <div className="space-y-4">
          <ReportMetadata generatedAt={result.generatedAt} requestedBy={result.requestedBy} />
          <ReportTable result={result} />
        </div>
      ) : null}
    </div>
  );
}
