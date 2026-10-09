# database/seed

Deterministic synthetic sample data. Fixed UUIDs and fixed dates so report totals are reproducible. See docs/06_seed-data-spec.md.

All ordered stages are implemented, including twelve funded FDs and three real
interest cycles. P06-M02-T01 completion is an authorized M2 contribution; M5
retains stewardship. The strict checker verifies minimums, role/profile links,
signed-ledger balances, payouts/control totals and measured reseeding. Missing
ordered files fail before writes. See the specification for exact totals and the
routine-generated posting timestamp limitation.

Use `npm run verify:seed-validation -- --global` for disposable verification.
`npm run db:seed-validate` is read-only; `npm run db:seed-check` also reseeds the
configured database. Do not reset a developer database for verification.
