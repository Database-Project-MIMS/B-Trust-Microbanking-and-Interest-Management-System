# ADR-0027 — final predeployment audit and workflow completion

2026-10-09. User authorizes a whole-system audit, fixes across member boundaries,
completion of remaining SRS/ERD gaps, documentation updates and commits on the
current branch. No push or PR. This supersedes prior local-only implementation
scope; deployment itself and lecturer acceptance are separate.

Blueprint: rebuild and test an isolated database; repair deposit replay, financial
read consistency and document verification; replace operational prototypes with
real scoped workflows; implement accepted ADR-0010/0012 extensions after resolving
their remaining policy defaults; verify APIs, SQL integrity/security/concurrency,
browser workflows, production build and operational recovery. Never change merged
migrations. Existing owners retain stewardship. Record evidence and outstanding
external requirements honestly; a green suite cannot prove absence of all bugs.

User confirmed staff-only transfers and automatic principal return at FD maturity.
Transfers use TRANSFER_OUT/TRANSFER_IN, same-branch staff scope and deterministic
two-account locks. Savings follows ADR-0012 actual/365 daily closing balances,
with each 30-day period ending before the payment date; paid periods cannot overlap.
Closure interest policy is being clarified. Maturity is credited through an immutable
ledger posting with a unique per-FD receipt, never by changing balance alone.

## Final policy and implementation disposition — 2026-10-10

Savings uses the unpaid cursor/opening date to the exclusive cycle date, preserving all
unpaid days on delayed runs. Current mutable-plan rate is snapshotted at distribution.
Closure keeps zero/no-active-FD and adds a positive-unpaid-interest guard; the optional
final settlement questions received no answer, so no minimum exception/forfeiture is added.
Full local verification: 3,397 tests/116 suites, clean 70 migrations/28 tables,
backup/restore, typecheck/lint/build. Browser workflow and dependency limits: docs/21.
Only local commit/publication preparation is authorized; no push/PR/merge/deployment.
