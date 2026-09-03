# Member 4 — Transactions & Ledger Integrity

**Slot:** Member 4 (240298H · Jayawardhana P.S.P) · **Migration block (Phase 1):** `0160–0179`
**Branch prefix:** `feat/pPP-m04-<slug>`

## Your slice

Transactions & Ledger Integrity. You own this end to end — database, backend, frontend, tests and docs.

| Layer | You own |
|---|---|
| **Database** | `transaction`, `transaction_channel`, `transaction_reversal`; idempotency, reference and ledger indexes; reconciliation views |
| **Routines** | `sp_post_deposit`, `sp_post_withdrawal`, `sp_reverse_transaction`, `fn_next_transaction_reference`, `fn_account_running_balance`, `trg_financial_transaction_immutable` |
| **Backend** | `lib/db` (shared — you own it), `/api/transactions/*`, idempotency middleware, `/api/health` |
| **Frontend** | Deposit, withdrawal, receipt, account statement, reversal, reconciliation |
| **Report** | **RPT-05 — Customer activity report** |

**Files you own:** `lib/db/**` (shared, you approve changes), `app/transactions/**`, `app/reports/customer-activity/**`, `app/reconciliation/**`

## Copy-paste prompt for your Claude Code session

Paste everything between the lines at the start of each session.

---

```
You are helping Member 4 on the MIMS project (CS3043 Database Systems, Group 32).
My slice is: Transactions & Ledger Integrity.

Before doing anything, read these in order and do not ask me questions they answer:
1. AGENTS.md
2. .agent/current-state.md
3. docs/09_task-tracker.md
4. .agent/members/member-4.md
5. the current phase document in docs/phases/
6. docs/04_database-schema.md and docs/07_business-rules.md
7. memory.md (only if we are continuing previous work)
8. ui-registry.md (before you build any UI)

Then:
- Identify the tasks assigned to Member 4 with status READY in the task tracker.
- Confirm every dependency of that task is DONE. If a dependency is not DONE, tell me
  and stop — do not work around it.
- If the task is non-trivial, run /architect first and resolve the decisions with me
  before writing code.
- Implement the full vertical slice for ONE task: migration -> SQL tests -> service ->
  route handler -> page -> tests -> docs.
- Run the tests. Then run /review and address what it finds.
- If you built UI, run /imprint and update ui-registry.md.
- Update the task status in docs/09_task-tracker.md and .agent/current-state.md.
- Write a handoff in .agent/handoffs/ if another member depends on this work.
- Run /remember save if we are stopping before the task is finished.

Hard rules you must not break:
- No ORM. No Prisma, Drizzle, Sequelize, TypeORM. No Supabase, Firebase or InsForge.
- Handwritten parameterized SQL only ($1, $2, ...). Never concatenate user input into
  SQL. Dynamic identifiers come from a server-side allow-list.
- Money is NUMERIC(15,2) in the database and a string across the API. Never a float,
  never JavaScript arithmetic on money.
- Only lib/db may import pg. Route handlers call services; services own transactions.
- Business rules must be enforced on the server and, where they protect money or
  integrity, in the database. Never in the UI alone.
- Use only migration numbers inside my reserved block for the current phase. Never edit
  a migration that is already merged — write a new one.
- Do not modify files owned by another member. If a change there is genuinely required,
  stop, tell me, and write a handoff explaining it before touching anything.
- Do not invent schema. If something is missing from docs/04_database-schema.md, add it
  to docs/17_erd-gap-analysis.md and .agent/open-questions.md and ask me first.
- Work only on tasks assigned to Member 4. If you think another task is blocking or
  mis-assigned, tell me — do not silently pick it up.

Start by telling me which task you are picking and why, then run /architect.
```

---

## Your Phase 1 tasks

| Task | Title |
|---|---|
| P01-M04-T01 | Harden `lib/db` — retry, error mapping, redacted logging (**publishes I-2**) |
| P01-M04-T02 | `transaction_channel` schema and seed |
| P01-M04-T03 | Migration runner tests and clean-rebuild proof |
| P01-M04-T04 | Database health page |

Your Phase 3 work is the heart of the project's grade. The two things that must be right:
**lock before you decide** (`FOR UPDATE`, then re-read balance and status inside the
transaction), and **idempotency as a database constraint**, not an in-memory cache.

Full detail, dependencies and acceptance criteria: `../09_task-tracker.md`.

## Definition of Done reminder

A task is not done because the code runs. Check AGENTS.md §16 — in particular: the rule is
enforced by a **constraint or routine**, not only by your service; there is at least one
**negative** test proving it; `npm run db:rebuild` still works from empty; and the docs are
updated in the **same PR**.

## Before you open a PR

```bash
git fetch origin && git rebase origin/develop
npm run db:rebuild && npm run db:verify
npm run typecheck && npm test
```

Then fill in the PR template from `../14_git-workflow.md`.
