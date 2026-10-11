import Link from "next/link";

/** Consistent, explicit row actions with record-specific accessible names. */
export function RecordActions({ href, name, canEdit = false }: { href: string; name: string; canEdit?: boolean }) {
  return <div className="flex flex-wrap gap-2">
    <Link className="btn btn-secondary whitespace-nowrap" href={href} aria-label={`View details for ${name}`}>View details</Link>
    {canEdit && <Link className="btn btn-secondary" href={`${href}?edit=1`} aria-label={`Edit ${name}`}>Edit</Link>}
  </div>;
}
