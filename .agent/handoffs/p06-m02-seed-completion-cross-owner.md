# P06-M02-T01 — authorized seed completion contribution

**Date:** 2026-10-09 · **Contributor:** M2 · **Stewards:** M5 (seed), M4 (interest posting), M3 (eligibility tests)

Vibodha said “complete this” after the missing FD/interest/role seeds and dev's
`analyze.ts` typecheck failures were explained. This authorizes the necessary
cross-owner completion; no ownership transfers. M5 retains `database/seed/**`
and `scripts/seed-check.mjs`; M4 retains financial posting.

Implemented contribution: all seven roles covered (including a customer login link and manager staff profiles),
opening cash represented in the ledger, twelve funded FDs, three real interest
cycles with payout/control-total and re-run checks, and a strict checker that
fails missing data. New 0620 repairs collision-prone interest references without
editing 0460/0483 or changing financial table shape. Add a narrow type correction
for the newer dev diagnostic helper. Relevant acceptance tests and seed docs
are updated together. See ADR-0024 for the complete blueprint.

Necessary fixture compatibility: the M5 seed checker and FD-opening suites now
build their own freshly seeded databases in the guarded disposable cluster;
they cannot erase or count unrelated shared history. M4 interest tests use
distinct fixture FD identities and expect a duplicate FD/cycle credit to fail.
M3's assigned-AGENT eligibility test now selects a stored AGENT role, instead of
mistaking the newly seeded BM001 manager profile for an agent. Assertions remain
strict; no schema rule or visibility check is weakened. No ownership shifts.

FD seed creation has a same-transaction FD_OPENED audit alongside real principal
postings. Repeated seeding checks existing fixed IDs instead of duplicating audit
or financial effects. Posting hours and limits restore their actual prior values.

Include these M5/M4 contributions in the eventual PR description. No changes to
their other tasks or a general Phase 6 approval are implied. User handles Git
publication and integration of the newer dev.
