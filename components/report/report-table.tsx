import type { ReactNode } from "react";
import ReportTotals from "./report-totals";
import { reportMoney } from "./report-format";
import type { ReportResult } from "@/lib/report/report-handler";

export interface ReportColumn<T> { key: keyof T & string; label: string; kind?: "money" | "count" | "text"; render?: (row: T) => ReactNode }
export default function ReportTable<T>({ result, columns, rowKey }: {
  result: ReportResult<T>; columns?: ReportColumn<T>[]; rowKey?: (row: T) => string;
}) {
  const definitions: ReportColumn<T>[] = columns ?? Object.keys(result.rows[0] ?? {}).map(key => ({ key: key as keyof T & string, label: key, kind: "text" as const }));
  const render = (value: unknown, kind?: string) => kind === "money" ? reportMoney(value) : String(value ?? "—");
  return <div className="table-wrap">
    <table className="data-table">
      <caption className="sr-only">Agent transactions: page details, page subtotal and full-filter grand total</caption>
      <thead><tr>{definitions.map(column => <th key={column.key} scope="col" className={column.kind !== "text" ? "amount" : ""}>{column.label}</th>)}</tr></thead>
      <tbody>{result.rows.length ? result.rows.map((row, index) => <tr key={rowKey?.(row) ?? index}>
        {definitions.map((column, position) => position === 0
          ? <th key={column.key} scope="row">{column.render ? column.render(row) : render(row[column.key], column.kind)}</th>
          : <td key={column.key} className={column.kind !== "text" ? "amount" : ""}>{column.render ? column.render(row) : render(row[column.key], column.kind)}</td>)}
      </tr>) : <tr><td colSpan={Math.max(1, definitions.length)}>No agent rows on this page. Grand totals still cover all applied filters.</td></tr>}</tbody>
      <ReportTotals result={result} columns={definitions.map(column => column.key)}
        format={(value, key) => render(value, definitions.find(column => column.key === key)?.kind)} />
    </table>
  </div>;
}
