# Migration and Backup/Restore Evidence

Current local proof: P06-M02-T03, ADR-0026, 2026-10-09.
`npm run verify:operations` starts a generated loopback PostgreSQL cluster and runs
`tests/db/backup-restore.test.mjs` and `tests/db/migration-runner.test.mjs`.
It never drops or restores the developer database. The shell wrapper invokes this runner;
credentials are ephemeral environment values, never hardcoded or printed.

## Backup/restore

The test creates a fresh source database with the same seven-stage rebuild pipeline,
validates canonical AC-12 metrics, dumps a custom archive with pg_dump and restores
into a second generated database with pg_restore. It compares all 26 tables' row counts
and sorted whole-row hashes, exact account/ledger/FD/payout money totals, constraints,
RLS policies, relation ownership and sequence last_value/is_called. The restored migration
ledger must match all 58 files and checksums. Both generated databases and dump files
are removed after verification, including failure paths.

PostgreSQL may deparse two varchar-array CHECK casts differently after restore. The
comparison normalizes those equivalent casts only; operators, values and other schema
properties remain part of the comparison. This is not a row-count-only restore check.

## Migration atomicity and immutability

The migration runner test injects a failing DDL migration and proves neither its partial
DDL nor ledger row commits. It reapplies a correct migration, checks no-op reruns and
mutates a scratch migration file to prove checksum mismatch rejection. Source merged
migrations are preserved. No example hashes or fabricated command output substitute
for these executable assertions. Forward corrections use a new reserved migration.

Latest local operations evidence: 11 checks pass, zero failures/cancellations/skips.
The complete final-source run also includes these tests; see docs/12 and docs/20.
Node 24.15.0/PostgreSQL 18.6 are this host's versions; project Node 22 pin is unchanged.
This local proof does not verify a hosting platform or live HTTPS deployment.
