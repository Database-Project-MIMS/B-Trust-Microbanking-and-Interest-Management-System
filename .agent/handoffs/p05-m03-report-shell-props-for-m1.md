# Shared report components: three optional props (for review by M1)

**From:** Member 3 · **To:** Member 1 (owner of `components/report/**`, ownership map) · **Date:** 2026-10-08
**Why:** the RPT-02 screen needs report-specific text that `ReportTable` and `ReportMetadata` had hardcoded for RPT-01. AGENTS §13: a change to another member's file goes through a handoff.

## What changed (additive; defaults keep RPT-01 identical)
- `components/report/report-table.tsx`: optional `caption` and `emptyText`. Defaults are the previous text ("Agent transactions: page details, page subtotal and full-filter grand total" and "No agent rows on this page. Grand totals still cover all applied filters.").
- `components/report/report-metadata.tsx`: optional `sortLabels` (plain names for this report's sort keys). Default is RPT-01's map (`employeeNo`, `agentName`, `netTotal`).
- `components/report/report-shell.tsx`: passes `caption`, `emptyText` and `sortLabels` through.

## Evidence
`tests/e2e/account-summary-report-screen.test.mjs` renders the shell without the new props and asserts RPT-01's caption, empty text and "Net movement · Ascending" label are unchanged, and with them for RPT-02. No RPT-01 test changed or newly fails.

## Also noticed (not changed)
`ReportFilters` labels its branch select "Posting branch" and always shows the "Agent" select when given `agents`; RPT-02 does not pass `branches`/`agents` and supplies its own Branch select through `filterExtras`. If more reports need a plain "Branch" filter, a `branchLabel` prop would be the clean fix.
