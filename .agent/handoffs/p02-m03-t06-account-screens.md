# P02-M03-T06: account screens and real plans page

**From:** Member 3 · **To:** Member 3 (review/PR), Member 1 (nav + route scope), Member 2 (document verification), Member 4 (Phase 3 buttons) · **Date:** 2026-10-07
**Status:** merged into dev. Browser pass partial (2026-10-08): list, plans, wizard through review step and the server's `DOCUMENTS_NOT_VERIFIED` rejection verified; the successful opening and detail page await a verified document (Member 2). Known minor items: sub-minimum deposit not blocked client-side (server catches it); review-step card is narrower than the form.

## What exists
| Route | Component | Notes |
|---|---|---|
| `/accounts` | `app/accounts/account-list.tsx` | search, status/plan filters, sort, paging; "Open account" for AGENT and BRANCH_MANAGER |
| `/accounts/new` | `app/accounts/new/account-opening.tsx` (+ `customer-picker.tsx`, `account-opening-model.ts`) | plan → holders → mandate → deposit → **review card** → confirm; one `Idempotency-Key` per attempt |
| `/accounts/{id}` | `app/accounts/[id]/account-detail.tsx` | balance, plan, mandate text, holders, add-holder (BRANCH_MANAGER, confirmation step); `?notice=opened|existing` banner |
| `/plans` | `app/plans/page.tsx` + restyled `SavingsPlanClient.tsx` | all staff read; ADMIN/CENTRAL_OPS edit through an accessible dialog |

Pure modules (unit-tested, no React): `account-format.ts` (money, rate, date, mandate and eligibility text from strings) and `account-opening-model.ts` (wizard rules for usability, request body, key lifecycle, error routing). `account-client.ts` wraps fetch (never throws on HTTP errors; reads the CSRF cookie).
Backend touch: `GET /api/accounts/{id}` now also returns `minHolders`/`maxHolders` so the UI can hide "Add holder" on full or single-holder accounts.

## Review fixes (2026-10-07)
- Plans dialog: focus is trapped inside (`app/plans/dialog-focus.ts`); age/holder/rate/balance fields are validated before saving (`app/plans/plan-edit-model.ts`), so a typo can no longer be sent as `null` and clear an age limit.
- Account opening: a missing security token now shows its error on the review card as well.
- Still open (minor): `crypto.randomUUID` fallback for plain-http hosts, 401 redirect to sign-in, blur validation, detail page keeps data while refetching, focus moves between wizard steps.

## Manual browser checklist (the Chrome tool was disconnected, so this has NOT been run)
Prerequisites: apply migrations (`npm run db:migrate`, `npm run db:grants`), have an agent and a branch manager with a shared branch, a few customers **assigned to the agent**, each with a **verified** document (no endpoint verifies documents yet: set `verified_by` and `verified_date` in SQL), and today marked as a business day if testing after hours.
1. Agent → Accounts → Open account: pick Adult, search a customer, add, review card shows plan, holder, deposit; confirm → lands on the detail page with "Account opened."
2. Open another with a deposit (e.g. 1500.00): balance shows `LKR 1,500.00`. Click back, re-submit the same form quickly: you land on the same account with the "already opened" banner (one account, one ledger row).
3. Manager → open a Joint account with two holders and "All holders together"; detail shows the mandate; **Add a joint holder** → confirmation → holder count 3 and the mandate text says "All 3 holders".
4. Failures read well: add a holder with no verified document, a minor to a Joint plan, a deposit below the plan minimum, a deposit outside business hours. Messages are plain, inputs are kept.
5. Second agent cannot find or open the first agent's account (list empty, detail "not found").
6. Narrow the window to about 390px: no horizontal page scroll; tables scroll inside their boxes.
7. `/plans`: ADMIN or CENTRAL_OPS can edit (Esc closes, focus returns); AGENT sees no Edit buttons.

## Gaps and follow-ups
- **M1:** the shell nav has no "Plans" link (reachable by URL). Account nav roles exclude CUSTOMER, so a customer reaches an account only from their profile link.
- **M2:** no document-verification endpoint or screen, which blocks real-life opening until documents are verified.
- **M4:** the detail page deliberately has no Deposit/Withdraw/Statement buttons (their screens are still demos without an account parameter). Add them when the Phase 3 screens exist.
- **Phase 4:** FD panel on the detail page (P04-M03-T03) and the closing UI (P04-M03-T02).
- Tests: components are not rendered in CI because the runner uses `--conditions react-server`; the logic is covered by `tests/e2e/accounts-ui-model.test.mjs`, pages are compiled by `npm run build`, and the checklist above covers the rest.
- A latent bug in my T04 test 19 was fixed: it committed a deposit without pinning the business calendar, so it passed only during business hours.
