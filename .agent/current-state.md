# Current State

**Updated:** 2026-10-08 · **Owner:** M2
**Checkout:** feat/p03-m02-agent-attribution-activity · HEAD d8d1be2 (contains dev a4a6b9f)
**Work:** uncommitted P03-M02-T01, verified locally and ready for review

## Current implementation

Migration 0320 adds nullable transaction agent/branch snapshots, restrictive foreign
keys and two transaction_date reporting indexes. Existing immutable rows stay unchanged;
legacy producer column lists remain compatible. No new endpoint/UI or posting routine.
15 new attribution tests cover FK failures, deletion restrictions, NULL/legacy inserts,
owner/runtime immutability, transfer-stable totals, rollback, and a populated-ledger upgrade.

Full isolated verification passes: 501 tests in 45 suites, zero failures/skips;
24 migrations rebuild and checksum-verify; TypeScript, lint and production build pass.
The normal development database was not reset or migrated. /review finds no unresolved
T01 issues; /imprint is inapplicable. Handoff: handoffs/p03-m02-transaction-attribution.md.

## Authorization and phase state

Vibodha authorized the prescribed G-07 schema and an early start for T01 after the
phase restriction was explained, then explicitly requested implementation. ADR-0016
records the scoped exception. Phase 2 exit and general Phase 3 entry are not approved;
OQ-12/OQ-14 and G-04/G-14 remain pending. P03-M02-T02 stays TODO and is not delivered here.
T01 is REVIEW pending the user's PR and M4/team review, rather than formally DONE.

PRs #41 (M2 customer APIs), #42/#45/#46 (M3 mandate/opening/APIs), and #47 (M3 screens)
are merged. Existing M3 tracker REVIEW labels and its pending browser checklist need
owner reconciliation; no other member's status is changed by this task. M1-T03 and
M5's complete Phase 2 seeds remain recorded TODO. Old T05/M3 local-only publication
notes in dated handoffs are historical.

## Handoff and next work

M4's existing schema handoff reserves these additions for M2. The outgoing handoff
requires M4 future posting routines and M3 opening deposits to capture trusted values
inside their posting transaction. Current M3 opening deposits remain unattributed.
M1 retains transaction RLS/scope; nullable FKs are not authorization/completeness rules.
Apply 0320 through the normal migration runner when using the development database.

The user commits, pushes, creates PRs and merges. Nothing is staged or published by
this session. All five overview tables were reviewed; only M2's new work is recorded.
