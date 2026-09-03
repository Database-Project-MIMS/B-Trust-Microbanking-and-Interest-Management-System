# .agent/

Machine- and human-readable project state, kept separate from `docs/` (which is the
narrative documentation) and `memory.md` (which is session-to-session continuity notes).

| File / dir | Purpose | Updated by |
|---|---|---|
| `current-state.md` | Single source of truth for what phase/task is in flight right now | whoever finishes a task |
| `open-questions.md` | Every unresolved decision, with severity and what it blocks | whoever raises or resolves one |
| `ownership-map.md` | Which member owns which file paths | lead, at Phase 0; rarely changes after |
| `decisions/` | ADRs — durable architecture decisions and why | whoever makes the decision, with lead review |
| `handoffs/` | Short-lived notes when one member's work exposes a contract another depends on | the publishing member |
| `members/` | Per-member context: their slice, current task, recent history | that member, via `/remember save` |
| `checkpoints/` | Snapshot at each phase boundary — what shipped, what didn't, go/no-go | lead, at phase exit |

**Read order at the start of any session:** `AGENTS.md` → `current-state.md` →
`docs/09_task-tracker.md` → your `members/member-N.md` → the current phase doc.

Stale entries are worse than missing ones. If you finish a task, update
`current-state.md` in the same session — don't leave it for someone else to discover.
