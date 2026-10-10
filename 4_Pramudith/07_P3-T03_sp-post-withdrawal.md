# Phase 3 — Task 03: withdrawal posting and audited rejection

**Task ID:** `P03-M04-T03`
**Original branch:** `feat/p03-m04-sp-post-withdrawal` (PR #61 merged)
**Corrective checkout:** `feat/p05-m02-rpt01-view` (user-authorized M4 work, ADR-0021)
**Migrations:** merged 0362 retained; new `0363_p03_m04_withdrawal_contract_repair.sql`
**Status:** DONE — original PR #61 and corrective PR #67 merged. Historical pre-integration verification:663 tests /62 suites,34-migration rebuild/type/lint/build pass; current legacy caller ambiguities are recorded in the RPT-01 T02 handoff.
**Dependencies:** P03-M04-T02 and M3 I-4 (`fn_check_plan_minimum`, `fn_check_withdrawal_mandate`)

## Correction to the merged delivery

RPT-01 verification exposed invalid `after_value` audit writes, a procedure called
with PERFORM, wrong withdrawal-limit keys and a joint fixture split across statements.
The audit schema contains `actor_type` and `new_values`. An audit insert followed by
an exception in the same transaction cannot persist after rollback. The user explicitly
authorized M4 corrective work and its documentation; 0362 is immutable.

## Published database contract

The definitions live in new 0363; no separate rebuild-time routine file overrides them.

- `sp_post_withdrawal(account_id, amount, channel_id, user_id, signer_customer_ids uuid[],
  idempotency_key, narration, OUT transaction_id, OUT reference_number, OUT balance_after,
  OUT posted_at)` is the throwing financial core.
- The original single `requesting_customer_id uuid` overload remains as a wrapper,
  converting that ID to a one-element signer array. ALL_HOLDERS needs the array overload.
- `sp_try_post_withdrawal` has the array inputs and the same four outputs plus
  `OUT p_rejection_code varchar`. This is the audited entry for the future service.
- `sp_write_rejection_audit(account_id, user_id, reason)` writes one protected
  `WITHDRAWAL_REJECTED` audit using `new_values` and is called with CALL.

All procedures are SECURITY INVOKER, caller-transaction owned, explicitly executable
by mims_app, and revoked from PUBLIC. No service-level bare BEGIN/COMMIT is introduced.

## Locked financial operation

Validate positive finite two-decimal money within NUMERIC(15,2), channel/key/narration
shape and current active stored actor/context. Staff need active profile/branch and
matching context. Take a per-key advisory lock for a retry, then SELECT account FOR
UPDATE. Enforce staff branch, agent assignment or customer ownership before replay.
Customer self-service cannot assert that another holder signed; the future staff
service must obtain trusted signer evidence, not blindly accept IDs from JSON.

Replay binds account, actor, channel, amount, narration and canonical signer set to
its original success audit. Same payload returns the original result; changed payload
raises IDEMPOTENCY_KEY_REUSED without another effect. New posts recheck ACTIVE status,
existing business-calendar/hours, I-4 mandate, actual WITHDRAWAL_SINGLE_LIMIT and
WITHDRAWAL_DAILY_LIMIT keys, Colombo calendar-day history and I-4 plan minimum inside
the account lock. Missing/invalid limits fail closed. No manager-override flow is invented.

Success atomically inserts a positive WITHDRAWAL amount, exact balance_after, trusted
posting branch and AGENT-only reporting attribution, debits current_balance and writes
one success audit. A manager/admin is not automatically an attribution agent. References
come from the existing sequence; money never uses JavaScript number arithmetic.

## Audited rejection transaction boundary

`sp_try_post_withdrawal` runs the core in an inner PL/pgSQL exception block. Known
financial business rejections roll back that inner work, then record exactly one audit
in the outer transaction and return a code with NULL financial outputs:

`ACCOUNT_NOT_ACTIVE`, `OUTSIDE_BUSINESS_HOURS`, `MANDATE_NOT_SATISFIED`,
`LIMIT_EXCEEDED`, `INSUFFICIENT_FUNDS`, `BELOW_MINIMUM_BALANCE`.

The service must return the result from withTransaction, allow that audit-only result
to commit, then map the allow-listed code to a safe domain error outside the transaction.
Throwing inside withTransaction would discard the audit. Validation/authorization,
configuration and unexpected database errors still abort the transaction. Unexpected
success-audit failure rolls back the ledger and balance too. Legacy throwing calls do
not promise a persistent rejection audit after the caller rolls back.

T05 API/CSRF/service/UI work remains pending; this task does not create a live endpoint.
M1 reviews access/audit integration through the handoff. New schemas/signature consumers
must use the corrected audited entry before claiming FR-WD-05 acceptance.

## Verification

`tests/db/sp-post-withdrawal.test.mjs` uses guarded disposable committed fixtures and
restores parameter/calendar state. It covers success, all six financial rejections,
full joint signatures, exact money validation, current actor/scope, trusted attribution,
calendar closures, Colombo day bounds under another timezone, payload-bound replay,
same-key retry races, competing debits, legacy compatibility, runtime-role execution,
and complete rollback when success auditing fails. All money assertions use strings.

Final combined verification evidence and three-layer review are recorded in
`.agent/handoffs/p03-m04-withdrawal-contract-repair.md`. The user subsequently merged
the correction through PR #67. Current integration failures in old untyped callers
are in `.agent/handoffs/p05-m02-rpt01-api-ui.md`; the assistant does not publish work.
