# P06-M02-T01 — seed acceptance completed locally

**Date:** 2026-10-09 · **Contributor:** M2 · **Seed steward:** M5
**Branch:** `p06-m02-seed-validation` · **Base:** dev 095ea9c
**Integration verified:** exported dev 78aae1e, including merged PR #87, with this
delivery overlaid. No Git merge was performed.
**Status:** REVIEW; implementation and AC-12 pass, user publication pending.

## Authorization and delivery

Vibodha first approved the scoped early T01 start, then said “complete this” after
the missing seed coverage and newer-dev type errors were explained. ADR-0024
records the expanded scope; it was renumbered because latest dev already owns
M3's ADR-0023. General Phase 6 and T02/T03 remain separate. Vibodha subsequently
instructed “commit them using few commits,” authorizing grouped local commits.
Push, merge and PR creation remain with the user.

The earlier 2026-10-08 blockers (zero FDs/runs and three uncovered roles) are
resolved in this working tree. M5 retains stewardship; the necessary M5/M4/M3
contribution is recorded in `p06-m02-seed-completion-cross-owner.md`.

- All seven active roles have seeded active users. Managers have active staff
  profiles; CUSTOMER is linked to Adult One. Ordinary agents are counted by role.
- Accounts start at zero; ten idempotent opening deposits replace the previous
  unledgered cash. Existing mixed postings/reversals remain routine-generated.
- `14_fixed_deposits.sql` imports twelve fixed FD IDs, with real funding deposits,
  principal withdrawals, two principal returns and same-transaction FD_OPENED
  audit. Ten are ACTIVE; two historical MATURED rows share active-FD accounts.
  Current assigned agents and real joint signer sets authorize seed debits.
- `15_interest_runs.sql` executes three actual cycles through the existing
  interest/ledger routines. Each has ten payouts, no exceptions and matching
  controls. Attempting cycle two again must raise 23505 and change no financial
  count or total. No interest credit is hand-inserted.
- New `0620_p06_m02_interest_reference.sql` replaces only the collision-prone
  reference calculation. Full FD UUID + business cycle date fits varchar(50),
  distinguishes fixed UUIDs sharing prefixes, and rejects duplicate direct
  credits for one FD/cycle. Existing 0460/0483 and other merged migrations stay
  immutable. Signature, locking, NUMERIC arithmetic and ledger/balance/audit
  boundary remain unchanged.
- `seed-validation.mjs` is one read-only repeatable-read snapshot with fixed
  qualified SQL/exact counts. Missing evidence fails, never skips. In addition
  to minima it checks current assignments, staff/customer links, signed-ledger
  balances, plan minima, reversals and payout amounts/accounts/formulas/controls.
- `seed-check.mjs` uses the same strict validation, then compares actual before/
  after counts and exact financial totals following a real reseed. The loader
  fails missing ordered files before any DB write and safely reports SQLSTATE.
  Hours/limits restore their actual prior values, tested with nondefault settings.
- Seed-check/FD-opening tests rebuild owned child databases in the disposable
  cluster instead of counting or erasing shared fixtures. Interest tests use
  distinct FD identities and require a duplicate credit to fail. The M3 test
  selects an actual AGENT role rather than the new BM001 manager subtype.
- Newer-dev `analyze.ts` has valid extensionless imports and narrowed unknown
  errors. Ignored scratch exports are excluded from typecheck/lint inputs.

No new table, API endpoint, UI or dependency. Integration repairs add internal
audit-query/interest-request services and correct the existing endpoints. `/imprint` is not applicable.

## Clean-seed evidence

| Metric | Minimum / invariant | Observed |
|---|---|---|
| Branches | 3 | 3 |
| Ordinary AGENT profiles | 5 | 6 |
| Branch-manager profiles | Active profile per manager | 3 |
| Customers / current assignments | 15 / exactly one each | 15 / 15 |
| Accounts / holders | Fixture counts | 10 / 13 |
| Valid joint mandates | 2 | 2 |
| Fixed deposits | 10 | 12; ten ACTIVE, two MATURED |
| Transactions | 100 | 191 |
| Users / active roles covered | Every role | 14 / seven |
| Nonempty completed interest runs | 2 | 3 |
| Linked exact payouts | Consistent with runs/ledger | 30 |
| Unreconciled balances, below-minimum balances, invalid links/assignments/payouts/controls | 0 | 0 |

Exact balances sum to `1582020.52`; unsigned transaction amounts sum to
`10190147.52`; payouts and run controls sum to `66020.52`. Reseeding preserves
these measured values and counts. Unsigned totals are not a balance
reconciliation: each account is checked separately against signed ledger rows,
including direction from linked reversal originals.

Master FD identity/business dates and exact totals are reproducible. Production
routines still generate operational UUIDs, posting timestamps and audit timestamps.
The specification documents this limitation; immutable rows are never backdated.
The historical sample does not demonstrate automatic maturity as of today's date.

## Verification and review

Current branch: **186 focused tests /15 suites** and **865 full tests /87 suites**,
all pass with zero failures/cancellations/skips; clean **46-migration** rebuild,
checksum/reapply verification, measured reseeding, strict global CLI/checker,
typecheck and lint pass. Focused coverage adds database-derived birthday boundaries
to the existing 39 seed cases, steward checker, FD/interest and customer API proof.

Latest-dev overlay: matching focused186 proof and **51-migration** rebuild/
checksums/typecheck/lint; **940 full tests /95 suites, all pass**, with zero
failures/cancellations/skips. The earlier932/903pass/29fail diagnostic is superseded.

Vibodha explicitly instructed repair of those failures in other members' code.
The [integration repair handoff](p06-m02-integration-failure-repairs.md) records
production session/hash/UUID fixtures, explicit RLS/stored-role identity,
database-derived date boundaries, audit contract fixes, typed withdrawal calls,
CSV totals and safe audit/interest request response/service boundaries. No
authorization or ledger integrity rule was relaxed. M1/M3/M4/M5 stewardship remains.

The existing cycle function uses nested subtransactions rather than independently
committed per-FD transactions;
this seed proof does not certify that separate FR-INT-04 runtime requirement.

`/review` layers: plan alignment PASS (all minima, financial checks and necessary
completion delivered); system integrity PASS (posting routines/constraints,
exact SQL values, additive migration, explicit ownership handoff); scoped
readiness PASS (positive/negative/re-run/config/rollback tests). Full-suite
regression readiness PASS. The separate cycle-orchestration
limitation and general phase gates remain explicitly recorded above.
No frontend/browser change requires new UI testing. No normal DB was reset.

Final ignored evidence logs:

- `test-results/p06-m02-integration-final-current.log` — current full865 proof.
- `test-results/p06-m02-integration-final-dev.log` — latest-dev full940 proof.
- `test-results/p06-m02-integration-final-focused-current.log` — final focused186 proof.
- `test-results/p06-m02-integration-final-focused-dev.log` — final overlay focused186 proof.

Earlier seed-validation logs and intermediate compatibility failures are historical
and superseded. All temporary clusters are stopped and safely removed.

## Publication handoff

The user authorized local commits on this existing branch. The user integrates
latest dev and handles remote publication/review/merge.
The exported-copy verification is integration evidence, not a Git merge.
The eventual PR should name P06-M02-T01; migration 0620; M5 seed/checker and M1/M4/M3
fixture contributions; exact AC-12 counts and financial evidence; relevant tests;
authorized cross-owner integration repairs and the operational-timestamp limitation.
No UI screenshots
are required. General Phase 6 approval and T02/T03 are not implied.
