import React from 'react';
import type { ReportResult } from '../../lib/report/report-handler';

export default function ReportTotals<T>({ 
  result, 
  columns 
}: { 
  result: ReportResult<T>;
  columns: string[];
}) {
  if (!result.grandTotal && !result.subtotals) return null;

  return (
    <tfoot className="bg-gray-50 border-t-2 border-gray-300">
      {result.subtotals && (
        <tr>
          <td colSpan={2} className="px-3 py-3 text-sm font-semibold text-gray-900">
            SUBTOTALS
          </td>
          {columns.slice(2).map((col) => (
            <td key={col} className="whitespace-nowrap px-3 py-3 text-sm font-semibold text-gray-900">
              {result.subtotals![col] || ''}
            </td>
          ))}
        </tr>
      )}
      {result.grandTotal && (
        <tr>
          <td colSpan={2} className="px-3 py-3 text-sm font-bold text-gray-900">
            GRAND TOTAL
          </td>
          {columns.slice(2).map((col) => (
            <td key={col} className="whitespace-nowrap px-3 py-3 text-sm font-bold text-gray-900">
              {result.grandTotal![col] || ''}
            </td>
          ))}
        </tr>
      )}
    </tfoot>
  );
}
