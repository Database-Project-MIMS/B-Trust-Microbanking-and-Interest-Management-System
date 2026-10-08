import { type ReportResult } from './report-handler';

function csvRow(values: unknown[]): string {
  return values.map(v => {
    const str = String(v ?? '');
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  }).join(',') + '\n';
}

export function streamCsv(result: ReportResult<unknown>): Response {
  const headers = new Headers({
    'Content-Type': 'text/csv; charset=utf-8',
    'Content-Disposition': `attachment; filename="${result.reportName}_${result.generatedAt}.csv"`,
  });
  
  const stream = new ReadableStream({
    start(controller) {
      if (result.rows.length > 0) {
        controller.enqueue(new TextEncoder().encode(csvRow(Object.keys(result.rows[0] as object))));
        for (const row of result.rows) {
          controller.enqueue(new TextEncoder().encode(csvRow(Object.values(row as object))));
        }
      }
      if (result.grandTotal) {
        controller.enqueue(new TextEncoder().encode(csvRow(['', '', 'GRAND TOTAL', ...Object.values(result.grandTotal)])));
      }
      controller.close();
    },
  });
  
  return new Response(stream, { headers });
}
