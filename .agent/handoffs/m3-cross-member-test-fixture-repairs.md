# Cross-member edits by Member 3 (AGENTS.md §13): stale test fixtures and a conflict marker

**From:** Member 3 · **To:** Member 1 (business-rules tests), Member 2 (`current-state.md`) · **Date:** 2026-10-08
**Why:** while verifying P04-M03-T01 the full isolated suite failed in suites that had nothing to do with it (a fixture fix to M4's `sp-post-withdrawal` test was also tried, but upstream has since rewritten that file, so it was dropped). The user asked M3 to repair them. Ownership does not shift; please mention these edits in the PR description.

| File | Owner | Change | Result |
|---|---|---|---|
| `tests/api/business-rules.test.mjs` | M1 | Fixture inserts now supply `branch.district`, the required `agent` columns (`date_of_birth`, `gender`, `phone`, `address`, `hired_date`) and `account.opened_by_agent_id` (all NOT NULL in the merged schema) | suite passes |
| `tests/db/business-hours-limits.test.mjs` | M1 | Same three fixture repairs | suite passes |
| `.agent/current-state.md` | M2 | Removed the unresolved `<<<<<<<`/`=======`/`>>>>>>>` markers from the "phase 7" merge; both sections kept verbatim | no content lost |

No application code, migration or routine was changed. M3 also appended its own sections to `.agent/current-state.md`, `.agent/open-questions.md` and `.agent/members/member-3.md`.
