import type { ReactNode } from "react";

export function RecordDetails({ items }: { items: { label: string; value: ReactNode }[] }) {
  return <dl>{items.map(item => <div key={item.label}><dt>{item.label}</dt>
    <dd className="break-words">{item.value ?? "—"}</dd></div>)}</dl>;
}
