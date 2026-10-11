# ADR-0034 — Record details and permitted editing

2026-10-11 · P06-M02-T04 · user-authorized scoped enhancement

The user requests a new branch, explicit View/Edit actions for branches, agents,
customers, accounts and fixed deposits, and a few local commits. PR #97/#98 must
merge before a new PR is created. Start from their combined local tree at 9e41cd3.
No push, merge, deployment or premature PR is part of this delivery.

## /architect blueprint

View means a dedicated, linkable detail page displaying stored registration fields
and related records inside current role/branch/assignment/self scope. Edit means
an authenticated, CSRF-protected form for permitted mutable fields, never direct
financial balance changes. The user explicitly confirmed FD opening terms remain
read-only, with full details and existing management actions.

Reuse organization PATCH APIs and existing detail pages. Add scoped organization
and FD GET APIs; customer contact/name/gender editing and manager-only account
ACTIVE/FROZEN and joint mandate editing. Identity/birth date and ownership/opening
terms remain protected; customer manager email masking must not enter an edit form.
FD details show its linked account, visible holders, branch, snapshot rate and dates.
Account closure continues through the existing guarded operation. No schema objects,
new financial workflows or changes to merged migrations are required.

Implement shared accessible detail/edit primitives; explicit table actions; safe
error/retry/loading states; server permissions and transactional audit. Verify API
negative cases, runtime SQL constraints, rendered controls and production browser
navigation/editing using only disposable synthetic data. Then /review, /imprint,
/remember save, update contracts/state/overview and create focused local commits.

This scoped task is assigned to M2 IN_PROGRESS; cross-owner contributions to M3/M5
pages/services and M1's security contract are necessary for the explicit request.
Original stewardship and general phase gates remain unchanged. Handoff records
the affected owners. REVIEW follows local verification, pending publication/review.

## User follow-up — filters and agent navigation

The user adds filtering for branches, agents and fixed deposits, and specifies the
agent menu order: Dashboard, Withdraw, Deposits, Transfers, Customers, Accounts,
Savings plans, Fixed deposits. Continue the same task/branch. Branch filters combine
literal text search, district and status; agent filters combine literal search, permitted
branch and status; FD filters combine account/visible-owner search, product and status.
Search applies draft fields, Clear filters restores defaults, FD searches reset pagination.
Filtering belongs in validated parameterized SQL with existing scope/RLS, including
owner-name searches. Filter choices come from permitted branches and the existing product
catalogue, including historical products. No migration or financial writes. Preserve the
list response shape and existing service callers. M1 retains shared navigation/security
ownership; the explicit request authorizes this contribution. Verify API negative/scoped
cases, rendered filters and role-specific menu ordering, then production browser/review.
