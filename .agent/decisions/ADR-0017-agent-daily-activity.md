# ADR-0017 — Agent daily activity read contract

**Date:** 2026-10-08 · **Owner:** M2 · **Task:** P03-M02-T02
**Status:** Implementation authorized by Vibodha's explicit “do it” / “Do it”.

PR #49 merged the T01 dependency into dev (c2bce7c). This is a scoped early start
for T02 on feat/p03-m02-agent-daily-activity. It does not approve Phase 2 exit,
general Phase 3 entry, OQ-12/OQ-14, or other members' posting work.

## /architect decisions

- A read transaction revalidates the caller's active stored role and branch profile,
  sets the existing RLS context, and reads target metadata and totals from one
  REPEATABLE READ snapshot. No balance or ledger mutation.
- ADMIN/CENTRAL_OPS can read any ordinary agent. AGENT can read only itself.
  BRANCH_MANAGER can read current own-branch ordinary agents and only ledger rows
  whose captured transaction.branch_id equals that branch. NULL branch rows are
  excluded for managers. This prevents a transferred agent exposing old-branch
  history to its new manager. Self and bankwide access retain attributed history.
- The task card's current-profile-only branch filter is insufficient after transfers;
  the extra posting-branch filter implements FR-ORG-04 / NFR-SEC-07 without changing
  immutable history. AUDITOR/CUSTOMER remain excluded from this operational endpoint.
- Validate UUID and real ISO calendar dates. Both omitted dates mean today in
  Asia/Colombo; one supplied date means that one day. Reject reversed, duplicate,
  or unknown query parameters. Include both dates using local midnight to midnight
  after the final date, independently of the PostgreSQL session timezone.
- PostgreSQL performs COUNT/SUM by transaction type, preserving exact decimal strings
  for money. Counts are integer numbers. Empty ranges return an empty byType array.
  Reversal/interest amounts remain separate positive type totals, never a net balance.
- Reuse migration 0320 and its indexes; no DDL or changes to another member's producer.
  Unattributed rows cannot be inferred from the initiator or an account's current agent.
- Live M2 page uses existing tokens, date controls, loading/empty/error/retry states;
  manager/bankwide agents list links to it and agents have a link from Customers.

The user controls commit, push, PR and merge. M1 retains transaction RLS; explicit
service SQL scope is enforced today. Future M4/M3 producers must populate snapshots.
