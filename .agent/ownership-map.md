# Ownership Map

Which member owns which paths. "Owns" means: merges without needing another member's
approval on *content* (a review is still required per `docs/14_git-workflow.md`), and is
the person to ask before anyone else edits it.

A path is owned even when the file does not exist yet. If your task needs a file listed
below (or clearly inside one of these globs) and it has not been created, do not create
it — raise a blocker note in `.agent/blockers/` and notify the owner. See `AGENTS.md`
§13.1.

Paths not listed are shared — anyone may touch them, but changes to genuinely shared
infrastructure (`lib/db`, `AGENTS.md`, migration `0000`) should go through the member
listed as its steward below, or through the lead.

| Path | Owner | Notes |
|---|---|---|
| `lib/auth/**` | M1 | requireRole, branchScope, session, CSRF |
| `app/(auth)/**`, `app/admin/**` | M1 | sign-in, shell, admin pages |
| `components/app-shell/**` | M1 | shared shell — all members render inside it |
| `components/report/**` | M1 | report framework primitives |
| `database/roles/**` | M1 | GRANTs, RLS policies |
| `app/branches/**`, `app/agents/**`, `app/customers/**` | M2 | |
| `app/reports/agent-transactions/**` | M2 | RPT-01 |
| `app/plans/**`, `app/accounts/**` | M3 | |
| `app/reports/account-summary/**` | M3 | RPT-02 |
| `lib/db/**` | M4 (steward) | shared by everyone; changes reviewed by M4 |
| `app/transactions/**`, `app/reconciliation/**` | M4 | |
| `app/reports/customer-activity/**` | M4 | RPT-05 |
| `app/fd-products/**`, `app/fixed-deposits/**`, `app/interest-runs/**` | M5 | |
| `app/reports/active-fds/**`, `app/reports/interest-distribution/**` | M5 | RPT-03, RPT-04 |
| `database/seed/**` | M5 (steward) | integrates seed contributions from all members |
| `AGENTS.md`, `CLAUDE.md`, `memory.md`, `ui-registry.md` | lead | propose changes via PR, anyone may propose |
| `database/migrations/0000_*` | lead | shared foundation; changes need group agreement |
| `docs/**` | whoever's work it documents | keep in sync in the same PR as the code change |
| `.agent/**` | whoever's state it is | current-state.md updated by whoever finishes a task |

## Database table ownership

For quick lookup — full detail in each member's prompt and `docs/04_database-schema.md`.

| Member | Tables |
|---|---|
| M1 | role, app_user, user_session, login_attempt, audit_log, system_parameter, business_calendar |
| M2 | branch, agent, customer, customer_agent, customer_document |
| M3 | savings_plan, account, account_holder, joint_mandate |
| M4 | transaction, transaction_channel, transaction_reversal |
| M5 | fd_plan, fixed_deposit, interest_payout, interest_run |

## When ownership needs to cross a boundary

Sometimes a task genuinely needs to touch another member's table (e.g. M3's account
opening needs to insert the first `transaction` row, owned by M4). This is expected —
that's what a **handoff** is for (`handoffs/README.md`): the owning member publishes the
interface (a function signature, a service method) and the calling member uses it without
editing the owner's files directly.
