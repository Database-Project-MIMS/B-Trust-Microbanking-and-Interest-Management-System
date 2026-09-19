# Handoffs

A handoff is a short note one member writes when their work exposes something another
member's task depends on — a function signature, a service contract, a shape of data —
**before** the dependent work needs to start, so nobody blocks waiting on a Slack message.

## When to write one

- You've finished (or are about to finish) something another member's task list says they
  depend on (check `docs/09_task-tracker.md` dependencies and the integration point table
  in the relevant `docs/phases/phase-NN-*.md`).
- You're about to touch a file outside your own ownership (`ownership-map.md`) and the
  owner isn't available to ask directly — write the handoff, make the minimal change, tag
  the owner to review.

## Format

Filename: `I-<n>-<short-slug>.md` where `I-<n>` matches the integration-point ID in the
phase doc if one exists (I-1, I-2, I-5, I-6, I-7, I-8), otherwise a short descriptive slug.

```markdown
# I-N: Title

**From:** Member X · **To:** Member(s) Y · **Date/session:** ...
**Status:** draft | published | superseded by I-M

## What this gives you

The actual signature / contract / shape — code, not prose, wherever possible.

## Example usage

A short snippet showing how the dependent member calls it.

## What's NOT stable yet

Anything still likely to change, so the dependent member doesn't build on sand.
```

## Currently expected handoffs (from the phase docs)

| ID | From | To | About |
|---|---|---|---|
| I-1 | M1 | all | `requireUser()`, `requireRole()`, `branchScope()` |
| I-2 | M4 | all | `withTransaction()`, SQLSTATE → domain error mapping |
| I-4 | M3 | M4 | plan-minimum check callable from the withdrawal path |
| I-5 | M4 | M5 | posting `INTEREST_CREDIT` through the ledger routine |
| I-6 | M3 | M5 | account-side FD eligibility read under lock |
| I-7 | M1 | M2, M3, M4, M5 | report framework (filters, scope, metadata) |
| I-8 | M5 | all | seed file layout, fixed-UUID scheme, load order |

The core I-1 implementation now resolves branch scope through `agent.branch_id` and fails
closed when a branch-scoped user lacks that profile. The accepted contract and remaining
quality follow-ups are recorded in `p01-branch-staff-scope-decision.md`. The remaining
rows are a forward-looking checklist, not a status report.
