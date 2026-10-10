# P04-M03-T03: fixed-deposit panel on the account detail page

**From:** Member 3 · **To:** Member 5 (FD opening page), Member 2 (customer FD panel owner), Member 1 (RLS on `fixed_deposit`) · **Date:** 2026-10-08
**Task:** P04-M03-T03 · **Status:** built and tested (tests only; no browser pass, by the user's choice). Early start at the user's direction; not a Phase 3 exit or general Phase 4 entry approval. No migration.

## What exists now
- `GET /api/accounts/{id}` (`getAccountDetail` in `services/account-service.ts`) returns `fixedDeposits: [{ fdId, fdPlanId, planName, principalAmount, interestRateAtOpening, startDate, maturityDate, nextInterestDate, status }] | null`, newest opening first, in the same REPEATABLE READ transaction. Money and the rate are exact strings; the rate is the snapshot taken at opening (BR-19). No account, customer or user ids are added. The type is `AccountFixedDeposit` in `types/account-fixed-deposit.ts`, derived from M2's `CustomerFixedDeposit` (`Omit<…, "accountId" | "accountNumber">`) so the two cannot drift.
- **`null` means "could not be read", not "none".** The FD read runs inside a savepoint: if it fails (for example a missing grant) the account is still returned with `fixedDeposits: null`, the failure is logged server-side with its SQLSTATE only (`logQueryError`), and a retryable conflict (serialization/deadlock) is rethrown, not swallowed. The page then says the deposits could not be loaded and offers no action, and shows no closure note, instead of claiming there are none.
- `/accounts/{id}` shows a "Fixed deposits" card (component `app/accounts/[id]/account-fixed-deposits.tsx`): the table, the empty state, a note when an ACTIVE FD blocks closing the account (supports `sp_close_account`, P04-M03-T02), and an **Open a fixed deposit** link to `/fixed-deposits/new?accountId=<id>`.
- The link shows only when the role may open FDs (AGENT, BRANCH_MANAGER, CENTRAL_OPS, per docs/15), the account is ACTIVE and it has no ACTIVE FD (one active FD per account, ADR-0011). The rule text lives in `fixedDepositPanel` in `app/accounts/account-format.ts` (pure, tested). The server still authorizes the FD page and API; the link is only a convenience.
- Read-only: nothing here writes to `fixed_deposit`.

## Notes for the owners
- **M5:** `/fixed-deposits/new` is currently the `WorkflowScreen` placeholder and ignores `?accountId=`. When the real opening page is built it should read that parameter to preselect the account. Until then the link lands on the placeholder.
- **M2/M1 (visibility):** the panel reads `fixed_deposit` under the caller's row-level security (0420/0421: AGENT assigned customers, BRANCH_MANAGER in-branch, CENTRAL_OPS/AUDITOR bank-wide, CUSTOMER own). The policy needs a holder inside the caller's branch scope, so an account whose holders are all in another branch than the account would show a manager no FDs. This affects only the display: `trg_account_close_guard` still blocks closing such an account (it reads FDs as the table owner).
- **Seed:** `database/seed/_load-order.txt` lists `14_fixed_deposits.sql` but the file is not in the tree, so there is no demo FD data; the tests create their own rows.
- I did not use `vw_customer_fd_summary`: it returns one row per holder × FD (duplicates on joint accounts) and is customer-oriented. The panel reuses its column names and table pattern instead.

## Evidence
- `tests/api/accounts.test.mjs` +4: empty for a new account; newest-first with exact strings, all statuses, exact key set and no foreign ids; manager, agent, CENTRAL_OPS, auditor and the CUSTOMER login all see the FD, while another branch's manager/agent and an unassigned agent get the uniform `404` with no FD data; with one column privilege on `fixed_deposit` revoked (disposable database, restored in `finally`) the account is still returned with `fixedDeposits: null`, and the list is back after the grant is restored.
- `tests/e2e/accounts-ui-model.test.mjs` +7 (`fixedDepositPanel`): nothing blocks an empty account; an ACTIVE FD blocks closing and opening another; MATURED/CLOSED block nothing; a frozen or closed account cannot start an FD; a role without the right gets no action; an unreadable list claims nothing; no ids or amounts in the text.
- `tests/e2e/account-fixed-deposits-panel.test.mjs` 8 (rendered markup, via `tests/helpers/render-account-fd-panel.mjs` in a child process because the runner's `react-server` condition hides the DOM renderer): exact product/principal/`14.00%`/dates/status cells, `scope` headers and `sr-only` caption, closure note, the Open link with the account id as the only id in the markup, history-only, role without the right, frozen account, unreadable list, no fixed-deposit or plan ids anywhere.
- Full isolated suite on this work merged with dev 81fd25c: 828 tests, 801 pass, 27 fail, 0 cancelled. The 27 are failures that also occur on dev without this work (`.agent/open-questions.md`); none involve this task. `tsc --noEmit`, `eslint .`, `next build` pass. `/imprint` saved ("Account fixed-deposits panel" in `ui-registry.md`).

## Not done
- No manual browser pass (tests only). The rendered markup is tested, but the visual layout (narrow width, table overflow) was not looked at in a browser.
- No Close button on the page; closing exists only as `POST /api/accounts/{id}/close` (T02, backend only).
