# P03-M03-T03: account balance panel and holder authority display

**From:** Member 3 · **To:** Member 4 (withdrawal/deposit pages), Member 1 (transaction RLS) · **Date:** 2026-10-08
**Status:** built and tested; browser pass not yet run.

## API (GET /api/accounts/{id}, `docs/05` updated)
- `availableToWithdraw` string = `max(0, current_balance − plan min_balance)`, computed in SQL (`::numeric(15,2)::text`; `GREATEST` alone drops the scale).
- `lastTransaction` = newest `transaction` row `{ transactionType, amount, transactionDate (UTC ISO), referenceNumber }` or `null`; no user ids.
- `mandate.state` = `EFFECTIVE | NOT_YET_EFFECTIVE | EXPIRED` against the Asia/Colombo date, same rule as `fn_withdrawal_mandate_verdict`.
Read in the existing REPEATABLE READ transaction, so balance and last transaction agree. Scope unchanged.

## UI
`/accounts/{id}`: balance card shows Available to withdraw and Last transaction; the mandate card is now "Who can authorise withdrawals" with a state pill and a blocked message; non-ACTIVE accounts show a notice; holders table has an Authority column. Pure helpers in `account-format.ts`.

## For M4
After `sp_post_deposit` / `sp_post_withdrawal` post, a refresh of this page shows the new balance and last transaction with no further change. `transaction` has `SELECT` for `mims_app` and no RLS yet; when M1 adds transaction RLS, check this read still works for CUSTOMER and AGENT sessions.

## Evidence
`tests/e2e/accounts-ui-model.test.mjs` (+6), `tests/api/accounts.test.mjs` (+4: amounts at/above/below minimum, newest row, mandate states, scope and no ids). Full isolated suite 580/580; typecheck, lint, build clean.
