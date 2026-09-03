# 14 — Git Workflow

Simple enough for five students working in parallel, strict enough that nobody loses work.

## Branches

```
main       stable, accepted, demonstrable — protected, no direct commits
develop    integration — every feature branch merges here first
feat/pPP-mMM-<slug>   one branch per task
```

Branch names mirror task IDs. Task `P03-M04-T02` → `feat/p03-m04-post-withdrawal`.

```bash
git checkout develop && git pull origin develop
git checkout -b feat/p03-m04-post-withdrawal
```

## Commits

```
P03-M04-T02: post withdrawal with row locking

- sp_post_withdrawal locks the account before re-validating
- rejects overdraft and minimum-balance breach
- adds concurrency test for parallel withdrawals
```

Start with the task ID. Present tense. Commit working increments, not one giant commit at
the end.

## Pull requests

Open against `develop`. Rebase on `develop` first:

```bash
git fetch origin && git rebase origin/develop
npm run typecheck && npm test && npm run db:rebuild
```

### PR description template

```markdown
## Tasks
P03-M04-T02

## Database changes
- Migration: 0362_p03_m04_post_withdrawal.sql
- Routine: sp_post_withdrawal
- Index: ix_transaction_account_date

## Backend changes
- services/transaction-service.ts — postWithdrawal()
- app/api/transactions/withdrawals/route.ts

## Frontend changes
- app/transactions/withdraw/page.tsx

## Tests
- tests/db/withdrawal-rules.test.mjs (7 cases, incl. 4 negative)
- tests/db/concurrency.test.mjs

## Screenshots
<if UI changed>

## Migration order
Adds 0362. Requires 0341 (M3 minimum-balance function) to be merged first.

## Dependencies
Blocked on: P03-M03-T01 (merged)
Unblocks: P03-M04-T04

## Checklist
- [ ] Definition of Done (AGENTS.md §16) satisfied
- [ ] Docs updated in this PR
- [ ] /review run, findings addressed
- [ ] /imprint run (UI only)
```

## Review

At least one other member reviews. Reviewers check:

- No ORM, no Supabase/Firebase, no credentials in client-reachable code
- **All SQL parameterized**; dynamic identifiers allow-listed
- Transaction boundaries correct; lock acquired **before** the decision
- Constraints enforce the rule, not just the service layer
- Negative tests exist for every rule the PR claims to enforce
- Docs updated in the same PR
- No file owned by another member edited without a handoff

Approve, or request changes with a specific reason. "Looks good" without reading the SQL is
not a review.

## Merge order

Merge in dependency order — a PR whose dependency is unmerged stays open. Roughly:

1. Migrations and database objects
2. Services and route handlers
3. Frontend pages
4. Tests and documentation (usually in the same PR)

Squash-merge feature branches into `develop`. Merge `develop` into `main` only at a phase
checkpoint, after the phase exit criteria are met.

## Migration conflicts

This is the most likely source of pain on a five-person database project, so the workflow
is designed to make it nearly impossible.

**Prevention — reserved number blocks.** Each member has their own range per phase
(AGENTS.md §12): P3 M4 owns `0360–0379`. Two members can never pick the same number, so
migration files never conflict.

**If a conflict still happens** (two members somehow used one number):

1. Do **not** edit the merged file.
2. Rename **your own unmerged** file to the next free number in **your** block.
3. Rebase and re-run `npm run db:rebuild` on a clean database.

**If a merged migration is wrong:**

1. Never edit it. `scripts/migrate.mjs` detects a changed checksum and refuses to run.
2. Write a **new** migration in your current block that corrects it (`ALTER`, `DROP`,
   backfill).
3. Note the correction in the new file's header, referencing the original.

**Rebuild is the source of truth.** Before every PR:

```bash
npm run db:rebuild && npm run db:verify && npm test
```

If a clean rebuild does not reproduce your local database, your local database has drifted
and the migrations are the thing that is right.

## Keeping a branch current

```bash
git fetch origin && git rebase origin/develop     # rebase, don't merge
npm run db:rebuild                                # pick up others' migrations
```

Rebase daily. A branch that has not been rebased in a week is a merge conflict waiting to
happen.

## Protected branches

| Branch | Rule |
|---|---|
| `main` | No direct pushes; PR from `develop` only; CI must pass; phase checkpoint approved |
| `develop` | No direct pushes; PR only; one approval; CI must pass |

CI gate (SRS §9.2): lint · typecheck · **migrations apply to a clean database** · all tests
pass.

## Never

- Commit `.env` or any secret
- Force-push `main` or `develop`
- Edit a merged migration
- Merge your own PR without a review
- Commit `node_modules`, `.next` or a database dump
