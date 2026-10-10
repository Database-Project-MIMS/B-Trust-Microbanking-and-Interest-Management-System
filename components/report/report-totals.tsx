import type { ReportResult } from "@/lib/report/report-handler";
export default function ReportTotals<T>({ result, columns, format }: {
  result: ReportResult<T>; columns: string[]; format?: (value: string, key: string) => string;
}) {
  return <tfoot>{[
    ["Page subtotal", result.subtotals], ["Grand total · all applied filters", result.grandTotal],
  ].map(([label, values]) => {
    if (!values || typeof values === "string") return null;
    return <tr key={String(label)}>{columns.map((key, index) => index === 0
      ? <th key={key} scope="row">{String(label)}</th>
      : <td key={key} className="amount">{values[key] === undefined ? "" : format?.(values[key], key) ?? values[key]}</td>)}</tr>;
  })}</tfoot>;
}
