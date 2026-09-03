/**
 * Placeholder landing page.
 *
 * Phase 0 deliberately ships no business UI. Member 1 replaces this with the
 * authenticated application shell and role-aware dashboard in Phase 1
 * (P01-M01-T04). Do not build features here.
 */
export default function Home() {
  return (
    <main className="mx-auto max-w-3xl p-8">
      <h1 className="text-2xl font-semibold">MIMS</h1>
      <p className="mt-1 text-[var(--text-muted)]">
        Microbanking and Interest Management System — B-Trust Microfinance Bank
      </p>

      <div className="mt-6 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-6">
        <h2 className="text-lg font-semibold">Phase 0 — initialization complete</h2>
        <p className="mt-2 text-[var(--text-muted)]">
          No features are implemented yet. Start from <code>AGENTS.md</code>, then
          <code> docs/00_documentation-index.md</code>.
        </p>
      </div>
    </main>
  );
}
