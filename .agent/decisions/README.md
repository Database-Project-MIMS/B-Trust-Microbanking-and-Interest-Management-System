# Architecture Decision Records

Short records of decisions that are expensive to reverse, or that constrain more than one
member. Not every choice needs one — routine implementation details don't. A decision
earns an ADR when it changes the schema shape, a cross-member contract, or something a
future session would otherwise silently re-litigate.

## Format

```
# ADR-NNNN: Title

Date, status (proposed/accepted/superseded), the decision, why, what it rules out.
```

## Index

| ID       | Title                                                        | Status   |
| -------- | ------------------------------------------------------------ | -------- |
| ADR-0001 | PostgreSQL 16 with node-postgres, no ORM                     | Accepted |
| ADR-0002 | Vertical-slice work division, not layers                     | Accepted |
| ADR-0003 | Money as NUMERIC, rates as fractions                         | Accepted |
| ADR-0004 | current_balance as a maintained denormalisation              | Accepted |
| ADR-0005 | Reserved per-member migration number blocks                  | Accepted |
| ADR-0006 | Branch managers share the agent branch-staff profile         | Accepted |
| ADR-0007 | Customer login is optional                                   | Accepted |
| ADR-0008 | Savings accounts store their owning branch                   | Accepted |
| ADR-0009 | Joint accounts require a stored operating mandate            | Accepted |
| ADR-0010 | Transfers are in scope, linked by `transfer_group_id`        | Accepted |
| ADR-0011 | One active fixed deposit per savings account                 | Accepted |
| ADR-0012 | Savings accounts earn interest, on average daily balance     | Accepted |
| [ADR-0013](ADR-0013-phase-one-closeout-verification.md) | Isolated verification, restricted health details and transaction-safe sessions | Accepted |
| [ADR-0014](ADR-0014-customer-service-numbering-and-scope.md) | Customer numbering, scoped registration and masked reads; renumbered from conflicting 0013 | M2 implementation decision within authorized T04; team review pending |
| [ADR-0015](ADR-0015-customer-api-runtime-integration.md) | Customer route/screens, child scope and shared RLS/audit integration | M2 implementation decision within authorized T05; M1 security review retained |
| [ADR-0016](ADR-0016-transaction-attribution.md) | G-07 transaction snapshots and scoped early start for P03-M02-T01 | User-authorized M2 implementation; M4/team review retained |
| [ADR-0017](ADR-0017-agent-daily-activity.md) | Agent daily activity dates, snapshot branch scope and scoped T02 start | User-authorized M2 implementation; M1/M4 integration review retained |

| [ADR-0018](ADR-0018-customer-fd-listing.md) | Customer FD view/API/profile listing and scoped P04-M02-T01 early start | User-authorized M2 implementation; M1/M5 read-policy review retained |
| [ADR-0019](ADR-0019-customer-fd-branch-scope.md) | Current-actor FD RLS backstop and scoped P04-M02-T02 start | User-authorized M2 implementation; M1/M5 policy review retained |
| [ADR-0020](ADR-0020-rpt01-view.md) | RPT-01 timestamp/type/posting-branch view and scoped P05-M02-T01 start | User-authorized M2 database-only implementation; I-7/T02 pending |
| [ADR-0021](ADR-0021-withdrawal-contract-repair.md) | Authorized M4 withdrawal correction, array signers and audited rejection boundary | User-authorized cross-member repair; M4 ownership retained |
| [ADR-0023](ADR-0023-ledger-posting-order.md) | `transaction.ledger_seq` posting-order key (G-24) and RPT-02 view v2 | User-authorized M3 implementation on M4's table; M4 review retained |
| [ADR-0022](ADR-0022-rpt01-api-ui.md) | Scoped RPT-01 runtime readers, snapshot CSV and approved I-7 repairs | Explicitly approved by user; M1 ownership retained; general phase entry pending |
| [ADR-0024](ADR-0024-seed-validation.md) | Strict seed acceptance, authorized seed completion and 0620 interest-reference repair | User-authorized scoped start/completion; M5/M4 ownership and general phase gates retained; numbered after dev's ledger-order ADR-0023 |

| [ADR-0027](ADR-0027-predeployment-completion.md) | Whole-system/frontend audit, staff transfers, savings catch-up, automatic maturity, admin/reset and safe closure guard | User-authorized cross-member local delivery; review/publication and live deployment separate |
