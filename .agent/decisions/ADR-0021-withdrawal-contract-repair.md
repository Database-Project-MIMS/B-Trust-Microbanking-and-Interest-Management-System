# ADR-0021: Authorized M4 withdrawal repair and audited rejection boundary

**Date:** 2026-10-08 · **Task:** P03-M04-T03 (reopened)
**Status:** User-authorized cross-member corrective work; teammate review retained

Vibodha explicitly authorized changing/creating M4 work and updating its documents
after RPT-01 verification exposed the merged withdrawal defects. M4 remains owner;
work is a correction to T03, not a new API/UI task or general phase approval. Keep
the current feat/p05-m02-rpt01-view checkout and list both task IDs in the user PR.

## Blueprint

Use new M4 migration 0363; merged 0362 is immutable. Correct `after_value` to
`new_values` (actor_type already exists), and read the real WITHDRAWAL_SINGLE_LIMIT /
WITHDRAWAL_DAILY_LIMIT parameter keys. Use the existing business-calendar function,
Colombo day bounds, positive exact amounts, active channels and locked account state.
Serialize withdrawal retries by key, bind replay to the same operation/payload and
recheck after locking. Capture the authorized operating branch; only an AGENT actor
is automatically the reporting agent, not a manager/admin (ADR-0016).

An exception and an audit insert in the same transaction both roll back. Preserve
the legacy single-customer `sp_post_withdrawal` signature as a low-level wrapper;
add an array-signers overload for M3's I-4 ALL_HOLDERS contract. Neither procedure
commits. The new `sp_try_post_withdrawal` entry catches only known financial business
rejections in a PL/pgSQL subtransaction, rolls back financial effects, CALLs the
corrected audit helper in the outer transaction, and returns `p_rejection_code`.
The service must commit that audit-only result through withTransaction, then map
the known code to a safe domain error **after** the transaction resolves. Throwing
inside the transaction would discard the rejection audit. Unexpected errors still
abort everything. No autonomous transaction, bare service COMMIT or second financial
effect is introduced. T05 route/service/CSRF/signer authentication remains pending.

The stored routine verifies active actor/context and staff branch or customer
ownership, then locks the account before balance/status/mandate/limit decisions.
ADMIN is supported for controlled DB integration; planned API roles remain as documented.
Signers supplied to the DB must be authorized by the future service, not accepted
blindly from a request. No manager limit-override mechanism is invented.

Rebuild guarded disposable fixtures; test successful ledger/balance/audit atomicity,
every financial rejection with exactly one persistent audit/no ledger, ALL_HOLDERS,
precision/validation, scope, calendar, non-Colombo timezone, same-key concurrency,
conflicting replay and different-key competing debits. Run the full shared suite,
typecheck/lint/build with no exclusions. Record T03 and M2 T01 as local REVIEW until
the user publishes the changes. Update M4 overview/task/state and shared contracts.
