# Blockers

A blocker note is what you write when your task needs something another member owns and
it is **not there yet** — most often a file that has not been created. It is the opposite
direction of a handoff: a handoff says "here is what I built for you", a blocker says
"I am stopped until you build this".

The rule it implements is `AGENTS.md` §13.1: you never create a file that
`.agent/ownership-map.md` assigns to someone else, even when it does not exist yet.
Creating it "just as a stub" is how two branches end up authoring the same file and how
a real implementation gets silently overwritten at merge time.

## When to write one

- A file, service function, migration, table, route or type your task depends on is
  owned by another member and is missing or incomplete.
- The task that produces it is not `DONE` in `docs/09_task-tracker.md`, or does not exist
  in the tracker at all.
- You have checked `.agent/handoffs/` and there is no published contract for it.

Do **not** write a blocker note for something you own yourself, or for something already
covered by an open handoff — read the handoff and code against its contract instead.

## Format

Filename: `B-<phase>-<your member>-<short-slug>.md`, e.g.
`B-p01-m03-account-service-missing.md`.

```markdown
# B-pPP-mMM: Title

**Blocked member:** M<you> · **Owner needed:** M<them> · **Date/session:** YYYY-MM-DD
**Blocked task:** P01-M03-T02 · **Status:** open | resolved | withdrawn

## What is missing

Exact path(s), e.g. `lib/auth/require-role.ts`, and the owning task ID from
`docs/09_task-tracker.md` (or "no task exists yet" if that is the case).

## What I need from it

The contract, as precisely as you can state it — exported names, signatures, column
names, route shape, return type. Code, not prose, wherever possible. This is what the
owner should confirm or correct; it is not you deciding for them.

## Why I cannot proceed without it

One or two lines. If parts of your task *can* proceed, say which parts you completed.

## What I did instead

- Task marked `BLOCKED` in `docs/09_task-tracker.md`
- Unblocked parts finished: ...
- Owner notified: when and where

## Resolution

Filled in when unblocked: link the handoff, PR or ownership change that resolved it,
then set **Status: resolved**.
```

## Lifecycle

1. Author writes the note, marks the task `BLOCKED`, notifies the owner, and continues
   with the unblocked parts of their task.
2. Owner either ships the file, or publishes a contract in `.agent/handoffs/` and
   explicitly authorises the blocked member to create it, or the lead reassigns the path
   in `.agent/ownership-map.md`.
3. Blocked member sets **Status: resolved**, links the resolution, and returns the task
   to `IN_PROGRESS`.

Resolved notes stay in the repository — they are the record of why a file was created by
someone other than its original owner.
