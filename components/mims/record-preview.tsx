import type { ReactNode } from "react";
import { RecordDetails } from "./record-details";

/** Native expandable details for small reference records already loaded in a catalogue. */
export function RecordPreview({ title, items }: { title: string; items: { label: string; value: ReactNode }[] }) {
  return <details><summary className="btn btn-secondary whitespace-nowrap cursor-pointer" aria-label={`View details for ${title}`}>View details</summary>
    <section className="mt-4 space-y-3 text-left"><h2>{title}</h2><RecordDetails items={items} /></section>
  </details>;
}
