# P02-M03-T05: accounts and holders API

**From:** Member 3 · **To:** Member 3 (T06 UI), Member 4 (Phase 3), Member 1 (route scope/audit), Member 2 (document verification), Member 5 (seeds) · **Date:** 2026-10-07
**Status:** built and tested locally; `/review` and the user's PR pending (the user publishes).

## Endpoints (all JSON `{ data }` / `{ error: { code, message } }`; details in `docs/05_api-and-pages.md`)
| Route | Roles | Notes |
|---|---|---|
| `POST /api/accounts` | AGENT, BRANCH_MANAGER | `Idempotency-Key` required; `201` new, `200` replay; money as strings |
| `GET /api/accounts` | AGENT, BRANCH_MANAGER, CENTRAL_OPS, AUDITOR | branch scope in the query + RLS; an **AGENT sees only accounts with a holder actively assigned to them**; filters, allow-listed sort, paging |
| `GET /api/accounts/{id}` | + CUSTOMER if a holder | uniform `404` outside scope; `holderCount` is the true total even when RLS hides co-holders |
| `POST /api/accounts/{id}/holders` | BRANCH_MANAGER (owning branch) | `{ customerId }`; ALL_HOLDERS mandate follows the holder count |
| `POST /api/accounts/{id}/close` | BRANCH_MANAGER | `501` stub; BR-18 is Phase 4 |

## For T06 (UI)
- An AGENT can open an account only for customers assigned to them (`409 HOLDER_NOT_FOUND` otherwise, same answer as an unknown customer). The customer picker should come from the customer search API, which already applies the same assignment rule. Managers are not narrowed.
- Send `Idempotency-Key` (generate once per form submit, reuse it on retry) and `x-csrf-token`. A `200` means "already opened": show the original account.
- `initialDeposit` is a decimal **string**. The deposit channel is server-chosen.
- Map `error.code` to messages; codes are listed in `docs/05`. `422 IDEMPOTENCY_KEY_REUSED` means the form changed after a failed submit; generate a new key.
- `app/accounts/**` and `app/plans/**` still render the hardcoded `WorkflowScreen` demo (and `SavingsPlanClient` is not wired in); wiring them is T06's job.
- Documents: opening needs every holder to have a **verified** document, and no endpoint verifies documents yet (M2 follow-up). Until then the wizard can only open accounts for customers verified through seed/service.

## What was added
- `0244_p02_m03_account_opening_request.sql`: insert-only idempotency record, `UNIQUE (user_id, idempotency_key)`, request hash, `account_id`. The service takes `pg_advisory_xact_lock` on (user, key) and writes the row in the same transaction as the account.
- `0245_p02_m03_sp_add_account_holder.sql`: adds one JOINT holder (locks account, requires ACTIVE account and a verified, active customer); count/adult rules come from the 0242 trigger.
- `services/account-service.ts`, `services/account-errors.ts`, `lib/validation/account.ts`, routes under `app/api/accounts/**`.
- Error handling: `withTransaction` collapses every `P0001` into a generic error carrying the raw message, so the service translates the routine's named constraints **inside** the transaction (`throwAccountDatabaseError`). No ids or SQL text reach a client.

## For Member 1
M1-T03 (branch scope on customer/account routes) overlaps: these routes already apply branch scope in the query plus RLS (`resolveScope` re-validates user, role and branch inside each transaction). Review rather than duplicate. `joint_mandate` and `account_opening_request` still have no audit trigger or RLS policy; `sp_open_savings_account` audits the mandate and deposit explicitly.

## For Member 4
`GET /api/accounts/{id}` returns `currentBalance` as a string; the opening deposit is a `DEPOSIT` ledger row with `reference_number = 'OPEN-<account number>'` on the `BRANCH_COUNTER` channel. Switch the deposit step to `sp_post_deposit` once it exists.

## Test notes
`tests/api/accounts.test.mjs` runs the real route handlers as `mims_app` and removes its committed rows afterwards: the seed minimum check treats a small non-zero ledger or account count as a failure, and the immutable ledger guard is lifted only inside that cleanup (disposable database only).
