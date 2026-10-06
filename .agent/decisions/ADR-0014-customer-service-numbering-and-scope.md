# ADR-0014 — Customer service numbering and scope

2026-10-05 · M2 implementation decision within authorized P02-M02-T04

Renumbered on 2026-10-06 during PR #36 conflict resolution: dev already uses
ADR-0013 for Phase 1 closeout. This decision's content/authority remain unchanged.

Customer schema already requires a unique varchar(30) customer_number but specifies no
sequential format. Use CUS- plus 24 uppercase random hexadecimal characters (28 total),
with database UNIQUE as the guarantee. Numbers are opaque references, not sortable
registration counts. This avoids a MAX+1 concurrency race and does not invent schema.
Future seeds/UI must not assume sequential numbers.

Follow docs/05/task-card customer mutation roles AGENT/BRANCH_MANAGER. An AGENT assigns
new customers to self; a manager chooses an active ordinary agent in its branch. Reads
apply SQL branch/assignment/self predicates and recheck current active actor state.
Mask NIC/email for AGENT/BRANCH_MANAGER per the task card's conservative guidance;
CENTRAL_OPS/AUDITOR and self CUSTOMER retain authorized detail. Document paths stay
out of DTOs/audit. Registration's audit includes reference/branch/assignment/document
count only, inside the caller transaction.

This does not approve a change to M1's role matrix/grants/RLS or a new endpoint.
ADMIN discrepancy is already recorded in open questions. Runtime controller integration
is T05 plus M1 security work. M3 account_holder is currently absent; profile accounts
is null until its published contract is available, then links follow account scope.
