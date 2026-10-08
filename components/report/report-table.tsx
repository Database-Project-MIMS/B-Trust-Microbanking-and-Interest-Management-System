import React from 'react';
import ReportTotals from './report-totals';
import type { ReportResult } from '../../lib/report/report-handler';

export default function ReportTable<T>({ result }: { result: ReportResult<T> }) {
  if (result.rows.length === 0) {
    return <div className="p-4 text-gray-500">No records found.</div>;
  }

  const columns = Object.keys(result.rows[0] as object);

  return (
    <div className="overflow-x-auto shadow ring-1 ring-black ring-opacity-5 md:rounded-lg">
      <table className="min-w-full divide-y divide-gray-300">
        <thead className="bg-gray-50">
          <tr>
            {columns.map((col) => (
              <th key={col} scope="col" className="px-3 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500">
                {col.replace(/_/g, ' ')}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200 bg-white">
          {result.rows.map((row, i) => (
            <tr key={i}>
              {columns.map((col) => (
                <td key={col} className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                  {String((row as any)[col] ?? '')}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
        <ReportTotals result={result} columns={columns} />
      </table>
    </div>
  );
}
