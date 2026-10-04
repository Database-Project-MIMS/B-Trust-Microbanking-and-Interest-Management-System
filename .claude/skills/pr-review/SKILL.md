---
name: pr-review
description: Review a teammate's feature branch or PR against the MIMS Definition of Done (AGENTS.md §16) and documentation rules (§14). Runs the tests, checks migrations, services, routes, docs, ownership and tracker updates, and reports PASS/FAIL per item with file evidence. Report only; never edits.
---

Reviewer-side check for a MIMS pull request. Read-only: report findings, never fix them, never run git commands that change state (the user runs git themselves).

Usage: `/pr-review [task-id]` e.g. `/pr-review P02-M03-T02`. If no task ID is given, infer it from the branch name or commit messages and say what you inferred.

## Step 1 — Establish the benchmark
Read, in order: `AGENTS.md`, `docs/09_task-tracker.md` (the task row), the matching `docs/phases/phase-XX-*.md` section, `docs/member-prompts/member-N.md`, `.agent/ownership-map.md`, and any spec in `docs/specs/` for the task. State in 3 lines what the task was supposed to deliver. Do not ask questions the docs already answer.

## Step 2 — Collect the diff (read-only)
Use `git diff develop...HEAD --stat` and `git diff develop...HEAD --name-only` (read-only git is fine). Group changed files by area: migrations, routines/triggers/views, services, routes, components/pages, tests, docs, `.agent`. Note the base branch if `develop` doesn't exist locally.

## Step 3 — Verify each item (PASS / FAIL / N/A, with file:line evidence)

**Database**
1. Migrations sit in the author's reserved block (AGENTS.md §12), named `NNNN_pPP_mMM_slug.sql`, no number collisions.
2. No already-merged migration was modified (`git diff develop...HEAD --diff-filter=M -- database/migrations`).
3. Important rules are enforced by constraints/triggers/routines, not only in service or UI code. Money is `NUMERIC(15,2)`, rates `NUMERIC(6,4)`, timestamps `TIMESTAMPTZ`; FKs on financial history are `ON DELETE RESTRICT`.
4. Schema matches `docs/04_database-schema.md`; any deviation is flagged.

**Backend**
5. Services use `withTransaction()`, lock (`FOR UPDATE`) before deciding, re-validate after locking, and carry a one-line JSDoc stating the transaction boundary.
6. A financial op never leaves ledger/balance/audit inconsistent.
7. Route handlers follow parse → authenticate → authorize (role AND branch scope in the query) → validate → service → respond; no SQL in routes; `{ data }` / `{ error: { code, message } }` shape; correct status codes; `Idempotency-Key` on money-moving POSTs; CSRF on state-changing routes.
8. All SQL parameterized; dynamic identifiers from an allow-list; no `SELECT *`; no string-built SQL.
9. No `any`, no JS `number` money arithmetic, no leaked SQL/driver/stack errors, `pg` imported only in `lib/db`.
10. No prohibited tech (ORMs, BaaS, `NEXT_PUBLIC_*` DB secrets, committed `.env`, real data).

**Frontend** (if UI changed)
11. Matches `ui-registry.md` and `docs/11_ui-rules.md`; `ui-registry.md` updated; server-side validation exists for every client-side rule.

**Tests**
12. At least one DB-level and one API-level test; negative tests for each rule the task enforces; concurrency test where locking is claimed.

**Documentation (AGENTS.md §14)** — check each that applies:
13. `docs/04_database-schema.md` (schema changes)
14. `docs/05_api-and-pages.md` (endpoints/pages)
15. `docs/07_business-rules.md` (rules + enforcement point)
16. `docs/16_database-routines-views-indexes.md` (routines/views/indexes)
17. `docs/09_task-tracker.md` status updated
18. `.agent/current-state.md` updated
19. `00_OVERVIEW.md` Work Order Summary tables: finished tasks struck through with `~~`
20. Handoff in `.agent/handoffs/` if another member depends on it; ADR in `.agent/decisions/` if a cross-team decision was made; gaps in `docs/17_erd-gap-analysis.md` / `.agent/open-questions.md`

**Process**
21. Branch name matches task ID; commit messages start with the task ID.
22. No files owned by another member were edited without a handoff note (`.agent/ownership-map.md`).

## Step 4 — Run the evidence
Run, report real output, and do not claim success without it:
1. `npm run typecheck`
2. `npm run lint`
3. `npm run db:rebuild` (schema must rebuild from empty)
4. `npm test` (or `test:db` / `test:api` if scoped)

If `.env` or Postgres is unavailable, mark these "NOT RUN" with the reason; never mark them PASS. Warn that `db:rebuild` is destructive to the local dev database and only run it against a local DB.

## Step 5 — Judgment pass
Beyond the checklist: look for race conditions (two concurrent withdrawals), idempotency replays, branch-scope bypass, off-by-one in interest/day counts, and tests that assert nothing meaningful. Recommend running `/code-review high` and `/security-review` if not already done, and a manual click-through of one happy path and one negative path.

## Step 6 — Report
Output this structure:

```
PR REVIEW — <task id> — <branch>
Verdict: APPROVE | REQUEST CHANGES | BLOCKED
Task intent: <3 lines>

Blocking (must fix)
- <item #> <issue> — file:line — why it matters
Non-blocking (should fix)
- ...
Passed
- <item numbers, compact>
Evidence
- typecheck / lint / db:rebuild / tests: PASS | FAIL | NOT RUN (+ key output)
Missing docs
- <doc> — what should have been updated
Questions for the author
- ...
```

Save the report to `docs/reviews/pr-review-<task-id>.md` only if the user asks. Never edit code or docs under review, never post to GitHub unless asked.
