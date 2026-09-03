# AGENTS.md — MIMS Development Contract

**Project:** Microbanking and Interest Management System (MIMS) — B-Trust Microfinance Bank
**Course:** CS3043 Database Systems · Semester Project · **Group 32**
**Team:** 5 members · **Current phase:** Phase 0 complete, awaiting approval for Phase 1

This file is the single development contract for every team member and every Claude
session. If something here conflicts with your own assumption, **this file wins**.
If something here conflicts with `docs/`, the more specific document wins and you must
raise the contradiction in `.agent/open-questions.md`.

---

## 1. Project summary

B-Trust is a case-study microfinance bank in Sri Lanka. MIMS digitises its core
operations: branches and agents, customer registration, individual and joint savings
accounts, deposits and withdrawals, fixed deposits, a central 30-day interest cycle,
five management reports, and a protected audit trail.

**This is a Database Systems project.** The relational database is the authoritative
source of financial truth. The UI exists so a QA tester can exercise and demonstrate the
database. Grading follows demonstrated database competence, so implementation choices
must be traceable to course concepts (L01–L13). Do not enrich the frontend at the
expense of the database.

---

## 2. Mandatory read order

Before writing any code for a task, read these **in order**. Do not ask a question that
is already answered by one of them.

1. `AGENTS.md` (this file)
2. `docs/00_documentation-index.md`
3. `docs/03_architecture.md`
4. `docs/04_database-schema.md`
5. `docs/07_business-rules.md`
6. `docs/05_api-and-pages.md`
7. `docs/08_workload-division.md`
8. `docs/09_task-tracker.md`
9. the phase document for your task — `docs/phases/phase-XX-*.md`
10. your member prompt — `docs/member-prompts/member-N.md`
11. `.agent/current-state.md`
12. `memory.md` — only when continuing previous work
13. `ui-registry.md` — before building any UI component

---

## 3. Technology stack

| Layer | Choice | Notes |
|---|---|---|
| Frontend | Next.js (App Router) + TypeScript | Server Components by default; Client Components only where interaction requires it |
| Styling | Tailwind CSS | Tokens and patterns live in `ui-registry.md` and `docs/11_ui-rules.md` |
| Backend | Next.js Route Handlers + a service layer | All validation and authorization on the server |
| Data access | `pg` (node-postgres) with handwritten parameterized SQL | Pooled; server-only |
| Database | PostgreSQL 16 (15+ acceptable) | Constraints, routines, triggers, views, indexes |
| Money | `NUMERIC(15,2)` | Never `float`/`double`/`real` |
| Rates | `NUMERIC(6,4)` stored as a fraction (10% = `0.1000`) | |
| Time | `TIMESTAMPTZ`, Asia/Colombo for display | |
| Tests | Node test runner + SQL test scripts | `tests/db`, `tests/api`, `tests/e2e` |

**Node:** 20 LTS or 22 LTS. Pin with `.nvmrc`.

---

## 4. Prohibited technologies — non-negotiable

Introducing any of these fails the project's acceptance criteria (SRS AC-02).

- ❌ Prisma, Drizzle, Sequelize, TypeORM, MikroORM, Knex query-builder-as-ORM, or **any ORM**
- ❌ Supabase, Firebase, InsForge, PlanetScale SDKs, or any backend-as-a-service
- ❌ Database credentials in any browser-reachable code or `NEXT_PUBLIC_*` variable
- ❌ Any direct browser-to-database connection
- ❌ Business rules implemented **only** in frontend code
- ❌ Committing `.env`, real secrets, or real customer data

If you believe a prohibited tool is genuinely necessary, stop and record it in
`.agent/open-questions.md`. Do not install it.

> The reference repository `adrianhajdin/job_pilot` is a **workflow** reference only —
> its `AGENTS.md` / `CLAUDE.md` / `memory.md` / context-docs / skills pattern. Its
> technology choices (InsForge, Browserbase, Stagehand, OpenAI) and its data model are
> explicitly **not** to be copied.

---

## 5. Database-first principle

Every important rule must be enforced where it cannot be bypassed.

1. **Structural truths → constraints.** Uniqueness, referential integrity, allowed
   statuses, non-negative balances and positive amounts are `UNIQUE`, `FOREIGN KEY`,
   `CHECK` and `NOT NULL`.
2. **Multi-row financial invariants → routines.** Posting a deposit, withdrawal,
   reversal, account opening, FD opening and each interest credit run inside a single
   explicit transaction, in a stored routine or a service-owned transaction block.
3. **Immutability and audit → triggers.** Posted ledger rows reject `UPDATE`/`DELETE`.
   Controlled master-data changes write before/after values to `audit_log`.
4. **The UI validates for usability, never for safety.** Every rule enforced in a form
   must also be enforced on the server, and the important ones again in the database.
5. **Avoid putting all business logic in triggers.** Triggers are for integrity and
   audit. Orchestration belongs in routines and services with visible transaction
   boundaries.

A financial operation must never leave: ledger written but balance unchanged; balance
changed but no ledger row; or a financial row without its required audit/control state.
Any failure rolls back completely.

---

## 6. Folder responsibilities

```
app/                    Next.js App Router — pages and route handlers
  api/                  Route handlers only: parse → authorize → call service → respond
components/             Reusable UI. Must match ui-registry.md
lib/
  db/                   Pool, query helpers, withTransaction. The ONLY place pg is imported
  auth/                 Session, password hashing, RBAC helpers
  validation/           Zod-style input schemas (server-side)
services/               Business orchestration. Owns transaction boundaries
types/                  Shared TypeScript types
database/
  migrations/           Ordered, immutable-once-merged schema changes
  routines/             Functions and procedures (PL/pgSQL)
  triggers/             Trigger functions and their bindings
  views/                Reporting and helper views
  indexes/              Indexes with written justification
  roles/                Database roles, grants, RLS policies
  seed/                 Deterministic sample data
  tests/                SQL-level constraint / routine / concurrency tests
tests/                  db | api | e2e test suites
docs/                   All project documentation (see 00_documentation-index.md)
.agent/                 Persistent project-management state
.claude/skills/         Installed agent skills
scripts/                Setup, rebuild, seed, verification scripts
```

**`lib/db` is the only module permitted to import `pg`.** Route handlers never talk to
the database directly; they call a service.

---

## 7. Coding conventions

- TypeScript `strict: true`. No `any` in committed code — use `unknown` and narrow.
- Files and folders `kebab-case`; React components `PascalCase`; functions `camelCase`.
- Services export named async functions, not default exports.
- Errors: throw typed domain errors (`InsufficientFundsError`, `NotAuthorizedError`).
  Route handlers map them to status codes. **Never** leak SQL text, driver messages,
  stack traces or credentials to the client (NFR-SEC-05).
- Money never touches JavaScript `number` for arithmetic. Read `NUMERIC` as string,
  compute in SQL, and format only for display.
- Every exported service function has a one-line JSDoc stating its transaction
  boundary.

---

## 8. SQL conventions

- **Parameterized SQL only.** `$1, $2, …`. Never build SQL by string concatenation or
  template interpolation with user input (NFR-SEC-02).
- Dynamic identifiers (sort column, direction) come from a **server-side allow-list**,
  never from the request body.
- `snake_case` for all database identifiers. Tables singular (`account`, `transaction`).
- Every table has: surrogate `uuid` PK, `created_at TIMESTAMPTZ NOT NULL DEFAULT now()`,
  and `updated_at` where the row is mutable.
- Explicit column lists. Never `SELECT *` in application code.
- Foreign keys referencing financial history use `ON DELETE RESTRICT`.
- Lock before you decide: `SELECT … FOR UPDATE` on the account row, then re-validate
  status and balance **inside** the transaction.
- Migration file naming (blocks are reserved per phase and member — see §12):

  ```
  database/migrations/NNNN_pPP_mMM_<slug>.sql
  e.g. 0142_p01_m03_savings_plan.sql
  ```

- **A merged migration is immutable.** Corrections use a new migration with a new
  number. Never edit a migration that is already on `develop` or `main`.
- Every migration is re-runnable against a clean database and is recorded in
  `schema_migration`.

---

## 9. API conventions

- Route handlers live at `app/api/<resource>/route.ts`.
- Shape: `parse input → authenticate → authorize (role + branch scope) → validate →
  call service → map result → respond`. No SQL in route handlers.
- JSON responses: `{ data }` on success, `{ error: { code, message } }` on failure.
- Status codes: `400` validation, `401` unauthenticated, `403` scope/role denied,
  `404` not found, `409` business-rule conflict (overdraft, duplicate FD),
  `422` semantically invalid, `500` unexpected.
- Money-moving `POST` endpoints require an `Idempotency-Key` header. A repeated key
  returns the original result and does **not** create a second financial effect
  (FR-DEP-04).
- All state-changing routes are CSRF-protected (NFR-SEC-04).

---

## 10. Security rules

- Passwords: salted adaptive hash (`argon2id`, or `bcrypt` cost ≥ 12). Never plaintext,
  never reversible, never logged.
- Sessions: server-side session record; cookie is `Secure`, `HttpOnly`, `SameSite=Lax`,
  with inactivity timeout and server-side invalidation.
- Authorization is checked **on the server for every request**. Hiding a nav link is not
  access control (FR-AUTH-02).
- Branch scope is applied in the query, not filtered in JavaScript after fetching.
- Least-privilege database roles; the application role cannot `DROP`, cannot bypass
  audit triggers, and cannot `UPDATE`/`DELETE` posted ledger rows.
- Row Level Security policies on `customer`, `account` and `transaction` (NFR-SEC-07).
- Secrets only via environment variables. `.env` is gitignored; `.env.example` is
  committed and contains no real values.
- Only synthetic data. Ever. (BR-20, NFR-PRIV-02)

---

## 11. Transaction rules

Explicit boundaries, one business operation per transaction:

| Operation | Boundary |
|---|---|
| Open savings account | account + holders + mandate + optional initial deposit + audit |
| Post deposit | lock account → insert ledger → update balance → audit |
| Post withdrawal | lock account → re-validate status/mandate/limits/minimum → insert ledger → update balance → audit |
| Reverse transaction | insert compensating entry → link reversal → update balance → audit |
| Open fixed deposit | verify eligibility → debit principal → create FD → audit |
| Interest cycle | one transaction **per FD distribution**; the run row tracks totals |

Rules:

- Acquire the row lock **before** the decision, and re-read balance and status after
  locking. Validation done before the lock is stale.
- Never hold a transaction open across a network call or user interaction.
- The interest run processes each FD in its own transaction so one failure does not roll
  back already-completed distributions (FR-INT-04).
- Use `withTransaction()` from `lib/db`. Do not issue bare `BEGIN`/`COMMIT` in services.

---

## 12. Git workflow

```
main       stable, accepted, demonstrable work — protected
develop    integration branch — all feature branches merge here first
feat/pPP-mMM-<slug>    one branch per task
```

- Never commit feature work directly to `main`.
- Branch name must match the task ID: task `P03-M04-T02` → `feat/p03-m04-post-withdrawal`.
- Commit messages: `P03-M04-T02: post withdrawal with row locking`.
- Rebase your branch on `develop` before opening a PR.
- Every PR states: task IDs · database changes · backend changes · frontend changes ·
  tests · screenshots (if UI changed) · migration numbers added · dependencies.
- At least one other member reviews before merge.
- Full details and migration-conflict handling: `docs/14_git-workflow.md`.

**Reserved migration number blocks** (prevents two members inventing the same number):

Phase 0 reserves `0000–0099` for the shared foundation (owned by the integration lead).

| | M1 | M2 | M3 | M4 | M5 |
|---|---|---|---|---|---|
| Phase 1 | 0100–0119 | 0120–0139 | 0140–0159 | 0160–0179 | 0180–0199 |
| Phase 2 | 0200–0219 | 0220–0239 | 0240–0259 | 0260–0279 | 0280–0299 |
| Phase 3 | 0300–0319 | 0320–0339 | 0340–0359 | 0360–0379 | 0380–0399 |
| Phase 4 | 0400–0419 | 0420–0439 | 0440–0459 | 0460–0479 | 0480–0499 |
| Phase 5 | 0500–0519 | 0520–0539 | 0540–0559 | 0560–0579 | 0580–0599 |
| Phase 6 | 0600–0619 | 0620–0639 | 0640–0659 | 0660–0679 | 0680–0699 |

Use the next free number **inside your own block**. You never need to coordinate a
migration number with another member.

---

## 13. Member task-isolation rules

- Work **only** on tasks assigned to you in `docs/09_task-tracker.md` with status
  `READY` or `IN_PROGRESS`.
- Do not edit files owned by another member (`.agent/ownership-map.md` is authoritative).
- If your task genuinely requires a change to someone else's file:
  1. Write a note in `.agent/handoffs/` describing the change and why.
  2. Update `.agent/ownership-map.md` if ownership actually shifts.
  3. Mention it explicitly in the PR description.
  Do not silently edit and hope no one notices — that is how merge conflicts and lost
  work happen.
- Shared files have exactly one owner listed in `.agent/ownership-map.md`. Changes to a
  shared file go through its owner.
- Never edit a migration that another member has merged. Add a new one in your block.

---

## 14. Documentation update rules

Documentation is part of the deliverable, not an afterthought.

- Changing the schema → update `docs/04_database-schema.md` **in the same PR**.
- Adding or changing an endpoint → update `docs/05_api-and-pages.md`.
- Adding or changing a rule → update `docs/07_business-rules.md` with its enforcement point.
- Adding a routine, view or index → update `docs/16_database-routines-views-indexes.md`.
- Finishing a task → update its status in `docs/09_task-tracker.md`.
- Making a decision that affects others → add an ADR in `.agent/decisions/`.
- Discovering a requirement conflict → add it to `docs/17_erd-gap-analysis.md` and
  `.agent/open-questions.md`.
- Building UI → run `/imprint` and update `ui-registry.md`.

---

## 15. Required skills

Installed under `.claude/skills/` from `JavaScript-Mastery-Pro/jsm-agent-skill` (MIT).
Provenance and content hashes are in `skills-lock.json`.

| Skill | When to use |
|---|---|
| `/architect` | Before starting any non-trivial task. Resolves decisions before code. |
| `/remember` | `save` at the end of a session; `restore` at the start of the next. Maintains `memory.md`. |
| `/review` | After finishing a feature. Checks correctness against requirements, not just style. |
| `/recover` | When the same problem recurs. Diagnose root cause before patching again. |
| `/imprint` | After building UI. Captures patterns into `ui-registry.md`. |

---

## 16. Definition of Done

A task is `DONE` only when **all** of the following are true:

- [ ] Database objects created via a numbered migration in your reserved block
- [ ] Constraints/checks enforce the rule at the database level where the rule is important
- [ ] Service implements the operation with an explicit, correct transaction boundary
- [ ] Route handler validates and authorizes on the server (role **and** branch scope)
- [ ] All SQL is parameterized; dynamic identifiers come from an allow-list
- [ ] Frontend page/component exists, is usable, and matches `ui-registry.md`
- [ ] Tests written and passing: at least one DB-level and one API-level test
- [ ] Negative tests exist for the rules the task enforces
- [ ] Schema rebuilds cleanly from empty via `npm run db:rebuild`
- [ ] Relevant docs updated in the same PR (see §14)
- [ ] `/review` run and reported findings addressed or recorded
- [ ] `/imprint` run if UI was created
- [ ] Task status updated in `docs/09_task-tracker.md`
- [ ] Handoff written in `.agent/handoffs/` if another member depends on this work
- [ ] PR opened against `develop` with the required description sections

---

## 17. Starting and ending a Claude session

**Start**

1. `git pull origin develop && git checkout -b feat/pPP-mMM-<slug>`
2. Read the mandatory read order (§2).
3. Run `/remember restore` if you are continuing previous work.
4. Confirm your task is `READY` and its dependencies are `DONE`.
5. Run `/architect` for anything non-trivial. Do not write code until the important
   decisions are resolved.

**End**

1. Run tests. Run `/review`. Run `/imprint` if UI changed.
2. Update `docs/09_task-tracker.md`, `.agent/current-state.md`, and write a handoff if needed.
3. Run `/remember save`.
4. Commit, push, open the PR.

**Never do these**

- Never mark a task `DONE` with failing tests or an unrebuildable schema.
- Never invent a schema change that is not in `docs/04_database-schema.md`. Propose it in
  `docs/17_erd-gap-analysis.md` first.
- Never edit another member's migration.
- Never bypass a service to query the database from a route handler or component.
- Never begin the next phase without the phase checkpoint being approved.
