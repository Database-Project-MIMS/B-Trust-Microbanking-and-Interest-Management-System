import type { ReportResult } from "./report-handler";

export interface CsvColumn<T> { key: keyof T & string; label: string }
export interface CsvOptions<T> {
  columns?: CsvColumn<T>[];
  rows?: AsyncIterable<T>;
  notes?: string[];
  cleanup?: () => Promise<void>;
}

/** Quotes CR/LF/commas and blocks spreadsheet formulas; signed decimals remain exact. */
export function csvRow(values: unknown[]): string {
  return values.map(value => {
    let text = String(value ?? "");
    if (/^[\u0000-\u0020]*[=+@-]/.test(text) && !/^-?\d+(\.\d+)?$/.test(text)) text = "'" + text;
    return '"' + text.replace(/"/g, '""') + '"';
  }).join(",") + "\r\n";
}

/** Streams one record per pull; completion, failure and cancellation clean up the source. */
export function streamCsv<T>(result: ReportResult<T>, options: CsvOptions<T> = {}): Response {
  const columns = options.columns ?? Object.keys(result.rows[0] ?? {}).map(key => ({ key: key as keyof T & string, label: key }));
  let cleaned = false;
  async function cleanup() {
    if (!cleaned) { cleaned = true; await options.cleanup?.(); }
  }
  async function* records() {
    try {
      yield csvRow(["rowType", ...columns.map(column => column.label)]);
      const metadata = [
        ["Report", result.reportName], ["Generated at (UTC)", result.generatedAt],
        ["Requested by", result.requestedBy], ["Filters (Asia/Colombo)", JSON.stringify(result.filters)],
        ...(options.notes?.map(note => ["Note", note]) ?? []),
      ];
      for (const [label, value] of metadata) {
        yield csvRow(["METADATA", ...columns.map((_, index) => index === 0
          ? (columns.length === 1 ? label + ": " + value : label) : index === 1 ? value : "")]);
      }
      const source = options.rows ?? (async function* () { yield* result.rows; })();
      for await (const row of source) yield csvRow(["DETAIL", ...columns.map(column => row[column.key])]);
      if (result.subtotals) yield csvRow(["PAGE_SUBTOTAL", ...columns.map(column => result.subtotals?.[column.key] ?? "")]);
      if (result.grandTotal) yield csvRow(["GRAND_TOTAL", ...columns.map(column => result.grandTotal?.[column.key] ?? "")]);
    } finally { await cleanup(); }
  }
  const iterator = records();
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async pull(controller) {
      try {
        const next = await iterator.next();
        if (next.done) { controller.close(); await cleanup(); }
        else controller.enqueue(encoder.encode(next.value));
      } catch (error) { controller.error(error); await iterator.return(undefined); await cleanup(); }
    },
    async cancel() { await iterator.return(undefined); await cleanup(); },
  });
  const name = result.reportName.replace(/[^a-zA-Z0-9_-]/g, "_");
  const timestamp = result.generatedAt.replace(/[^0-9TZ-]/g, "-");
  return new Response(stream, { headers: {
    "Content-Type": "text/csv; charset=utf-8",
    "Content-Disposition": 'attachment; filename="' + name + "_" + timestamp + '.csv"',
    "Cache-Control": "private, no-store",
    "X-Content-Type-Options": "nosniff",
  } });
}
