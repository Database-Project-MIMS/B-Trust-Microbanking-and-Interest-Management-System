# Memory — MIMS

> Maintained by the `/remember` skill. This is **current state**, not a log.
> Overwrite stale content. Do not append endlessly.
> `/remember save` at the end of a session · `/remember restore` at the start of the next.

**Last updated:** Phase 0 initialization
**Current phase:** Phase 0 — complete, awaiting approval to begin Phase 1

---

## What was built

Phase 0 only — planning, documentation and shared foundation. **No business features
have been implemented.**

- Repository scaffolded: Next.js App Router + TypeScript structure, no business code
- Agent skills installed from `JavaScript-Mastery-Pro/jsm-agent-skill` (MIT) into `.claude/skills/`
- `AGENTS.md` development contract, thin `CLAUDE.md`, `ui-registry.md`, this file
- `.agent/` project-state directory with per-member context and ownership map
- `docs/` — 18 numbered documents, 7 phase documents, 5 member prompts
- ERD gap analysis completed against the brief and SRS — 20 findings recorded
- Shared database foundation: migration `0000` (extensions, `schema_migration`,
  shared domains, `set_updated_at()` trigger function) and `lib/db` pool + `withTransaction`

## Decisions made

See `.agent/decisions/` for the full ADRs. The load-bearing ones:

- **ADR-0001** PostgreSQL 16, `pg` driver, handwritten parameterized SQL. No ORM.
- **ADR-0002** Vertical slices, not layer-based division. Every member owns DB + backend + frontend.
- **ADR-0003** Money is `NUMERIC(15,2)`; rates are `NUMERIC(6,4)` fractions. Never floats.
- **ADR-0004** `account.current_balance` is a documented denormalisation, protected by a
  `CHECK (>= 0)`, row locking and the posting routines. The ledger remains authoritative.
- **ADR-0005** Migration numbers are allocated in reserved per-phase, per-member blocks so
  no two members can collide.

## Problems solved

- Migration-number collisions between five parallel members → reserved numeric blocks (ADR-0005).
- Ambiguity between "one FD ever" (ERD unique key) and "one *active* FD" (SRS) → recorded
  as gap **G-01**, escalated for human decision. Not silently changed.
- job_pilot reference contains prohibited technologies → only its workflow pattern
  (`AGENTS.md` / `CLAUDE.md` / `memory.md` / docs / skills) was adopted.

## Current state

- Nothing is running yet. `npm install` has not been executed; there is no database.
- `database/migrations/` contains only the shared `0000` foundation migration.
- No table from the ERD has been created yet — that begins in Phase 1.
- All Phase 1 tasks are `READY`; all later phases are `TODO`.

## Next session starts with

1. Obtain approval for the Phase 0 checkpoint and the ERD gap decisions (G-01, G-05,
   G-12, G-20 are blocking — see `.agent/open-questions.md`).
2. Then Phase 1 tasks `P01-M01-T01` … `P01-M05-T03` can start in parallel.

## Open questions

Tracked in `.agent/open-questions.md`. Four are blocking for Phase 2+:
OQ-01 (one active FD vs one FD ever), OQ-04 (savings-account interest in scope?),
OQ-05 (customer login required?), OQ-08 (account-to-account transfers in scope?).
