# ADR-0005: Reserved per-member migration number blocks

**Date:** Phase 0 · **Status:** Accepted

## Decision

Migration filenames are numbered `PPMM_...` where `PP` is a two-digit phase and each
member owns a fixed 20-number range within each phase:
`P*100 + (member_index-1)*20` through `+19`. E.g. Phase 1, Member 4:
`0160`–`0179`. Full table in `AGENTS.md` §12 and each member's prompt.

## Why

Five people writing migrations against a shared numbering sequence is the single most
likely source of merge pain on a database-heavy group project — two people picking `0043`
independently is a guaranteed conflict discovered only at merge time. Reserved blocks make
that structurally impossible: nobody ever needs to coordinate a number in real time.

## What it rules out

- Any migration number chosen ad hoc outside a member's reserved block
- Editing an already-merged migration file (the runner checksums applied migrations and
  refuses to re-run a changed one — corrections are new migrations, not edits)

## Consequence

A member who runs out of their 20-number block within a phase (unlikely, but possible for
M4 or M5 in a heavy phase) requests an extension into unused space from an adjacent block,
recorded as an update to this ADR — not by encroaching silently.
