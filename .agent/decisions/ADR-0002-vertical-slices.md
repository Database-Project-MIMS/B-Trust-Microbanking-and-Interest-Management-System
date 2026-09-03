# ADR-0002: Vertical-slice work division, not layers

**Date:** Phase 0 · **Status:** Accepted

## Decision

Five members each own a full vertical slice — database tables through UI pages — for a
coherent domain area (identity/security, organisation/customers, accounts/plans,
transactions/ledger, FDs/interest). Nobody is "the frontend person" or "the database
person."

## Why

The user's brief explicitly prohibits layer-based division: "NO layer-based division...
Every member must have meaningful DB + backend + frontend + tests + docs work." Beyond
compliance, layer-based division on a project this size creates a single frontend
bottleneck waiting on four people's APIs, and a single database bottleneck everyone else
is blocked behind — vertical slices let four of five members work in parallel most of the
time.

## What it rules out

- Any task assignment that gives one member only migrations, or only pages
- A shared "backend" owned by committee — every route handler has one clear owner

## Consequence

Cross-slice dependencies are real (e.g. M3's account opening needs M4's transaction
table) and are handled explicitly through the handoff mechanism
(`.agent/handoffs/README.md`) rather than by merging responsibilities.
