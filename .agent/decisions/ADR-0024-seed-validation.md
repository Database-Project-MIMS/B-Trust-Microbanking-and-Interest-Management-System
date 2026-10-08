# ADR-0024 — Scoped P06-M02-T01 seed validation

**Date:** 2026-10-08 · **Owner:** M2
**Status:** User-authorized early task and subsequent seed completion; general Phase 6 entry remains pending.

## Authorization and scope

After the Phase 6 gate was explained, Vibodha said “do it” for
P06-M02-T01. P03-M05-T01 is marked DONE on dev. The existing clean branch
`p06-m02-seed-validation` is retained at dev 095ea9c. This authorization covers
validation tests/tooling and its documentation, not T02/T03, general phase entry,
seed-owner changes, commits, pushes, PR creation or merges. This initial scope is
extended by the explicit completion authorization below. The local seed ADR was
renumbered from 0023 to 0024 because latest dev already has M3's ledger-order ADR-0023.

## Blueprint

### Completion authorization — 2026-10-09

After the three missing seed requirements and the newer dev typecheck failure
were reported, Vibodha instructed “complete this.” This extends T01 to the
necessary M5 seed/checker contributions and the small integration repair, with
ownership retained by M5. Add deterministic FD fixtures, real funding ledger
entries, three routine-generated interest cycles and active users for all roles.
Correct seed opening balances through ledger postings rather than inventing
unreconciled starting cash. Validate payout/control/ledger consistency as well
as counts; never count an empty completed run as proof of a working interest path.

The existing interest reference uses the first eight UUID characters, which are
identical for every fixed seed UUID. Use an additive M2 Phase 6 migration (0620)
to give each FD/cycle an unambiguous reference; preserve merged migrations.
Historical FD master rows are loaded with explicit dates/IDs, while deposits,
principal debits/returns and interest use existing posting routines inside the
seed transaction. Operational posting UUIDs/timestamps remain routine-generated;
the guaranteed determinism is master identity, business dates, counts and exact
financial totals, not byte-identical operational history. Record this existing
runtime-clock limitation in the seed specification. Do not alter financial history
or weaken immutability to backdate postings.

Verify both this branch and the newest dev in isolated exported copies; no Git
merge, commit, push or PR is authorized. General Phase 6 and T02/T03 stay separate.

“Minimum” is the required column of docs/06_seed-data-spec.md, not its larger
planned seeded counts. M2's task card requires three branches, five ordinary
AGENT profiles (managers do not inflate that count), fifteen customers, active
branch membership and exactly one current assignment per customer. Global
diagnostics also enforce two valid joint accounts, ten FDs, one hundred postings,
two interest runs and active-user coverage of each configured active role.

Use fixed, fully qualified SQL and exact integer strings. Counts and assignment
evidence are collected inside one read-only repeatable-read snapshot. Empty or
missing evidence fails; missing tables raise an error rather than becoming a skip.
The CLI defaults to the global check; organization-only output explicitly disclaims
global AC-12 acceptance.

Rebuild and re-seed only inside a new disposable PostgreSQL cluster. Compare
actual counts and SQL-produced financial total strings before and after reseeding;
negative assignment probes roll back. The seed test file rebuilds its own secondary
database inside the fixture-approved disposable cluster so other test suites'
committed records cannot pollute seed evidence. Original stewardship is retained;
the authorized completion adds migration 0620, seed/checker contributions and
cross-owner handoffs. Subsequent explicit authorization on 2026-10-09 covers
full-suite failure repairs in other members' code, including the audit/interest
request response paths and service boundaries. See
`../handoffs/p06-m02-integration-failure-repairs.md` for diagnosis and verification.
General Phase 6 approval and T02/T03 are not implied by this delivery.

## Local commit authorization — 2026-10-09

After verification, Vibodha instructed “commit them using few commits.” Group the
delivery into local seed coverage, integration repair and documentation commits,
using the repository's configured identity. This supersedes the earlier local
commit prohibition for this delivery; push, PR creation and merges remain user
actions. Retain REVIEW status pending publication/review.
