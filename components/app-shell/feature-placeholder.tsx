import Link from "next/link";

interface FeaturePlaceholderProps {
  title: string;
  description: string;
}

/** Renders an honest empty state for a workflow not implemented in the current phase. */
export function FeaturePlaceholder({ title, description }: FeaturePlaceholderProps) {
  return (
    <section className="card max-w-2xl" aria-labelledby="placeholder-title">
      <p className="text-sm font-medium text-[var(--primary)]">Not available yet</p>
      <h1 id="placeholder-title" className="mt-2 text-2xl font-semibold text-[var(--text)]">
        {title}
      </h1>
      <p className="mt-3 text-sm leading-6 text-[var(--text-muted)]">{description}</p>
      <Link className="btn btn-secondary mt-6" href="/dashboard">
        Return to dashboard
      </Link>
    </section>
  );
}
