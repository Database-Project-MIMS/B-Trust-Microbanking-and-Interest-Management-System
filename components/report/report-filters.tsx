import React from 'react';
import type { ReportRequest } from '../../lib/report/report-handler';

export default function ReportFilters({
  filters,
  onChange,
  disabled
}: {
  filters: ReportRequest;
  onChange: (f: ReportRequest) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex flex-wrap gap-4 items-end">
      <div>
        <label className="block text-sm font-medium text-gray-700">From</label>
        <input 
          type="date"
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm sm:text-sm"
          value={filters.from || ''}
          onChange={(e) => onChange({ ...filters, from: e.target.value })}
          disabled={disabled}
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700">To</label>
        <input 
          type="date"
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm sm:text-sm"
          value={filters.to || ''}
          onChange={(e) => onChange({ ...filters, to: e.target.value })}
          disabled={disabled}
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700">Branch ID</label>
        <input 
          type="text"
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm sm:text-sm"
          value={filters.branchId || ''}
          onChange={(e) => onChange({ ...filters, branchId: e.target.value })}
          disabled={disabled}
        />
      </div>
      <button 
        className="px-4 py-2 bg-blue-600 text-white rounded shadow-sm hover:bg-blue-700 disabled:opacity-50"
        disabled={disabled}
      >
        Apply
      </button>
    </div>
  );
}
