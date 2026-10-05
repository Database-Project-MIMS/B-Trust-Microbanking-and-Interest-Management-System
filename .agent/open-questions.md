# Open Questions

Raised during Phase 0 while reconciling the brief, SRS and ERD. Each entry says what it
blocks so nobody discovers the dependency by surprise.

## Blocking (must resolve before the phase noted can _finish_)

_(none — OQ-01, OQ-04, OQ-05 and OQ-08 were resolved on 2026-10-02, see below)_

## Non-blocking (approve when convenient, nothing is waiting on these)

### Customer contract discrepancies recorded 2026-10-05

- G-10/task card says "exactly one", but the prescribed partial index only enforces
  **at most one**. Implemented 0221 correctly; registration/reassignment must enforce
  existence in their transaction. The phase's full one-current-assignment exit stays open.
- Child ERD/card omits some lifecycle timestamps. Apply AGENTS.md §8's required
  created_at/updated_at with shared triggers; docs/04 B.4a and docs/17 G-10 record them.
  Migration recording follows actual filename/checksum runner, not card version/name SQL.
- docs/15's permission matrix permits ADMIN registration while docs/05 and the specific
  M2 task card list AGENT/BRANCH_MANAGER. T03 verification follows the narrower mutation
  contract and denies ADMIN. M1 should reconcile before exposing a verification endpoint.
- Tracker T05 describes frontend work; the specific 06 task card describes API integration
  with prebuilt dashboard screens. Follow that card when implementing T04/T05 and confirm
  actual screen wiring then. No claim of customer registration completion is made here.
- Customer runtime grants/RLS and generic audit bindings are absent in this checkout.
  M1 integration is required before exposing customer services through runtime routes;
  owner-based disposable tests certify service logic only, not runtime policies.

| ID    | Question                                                                                   | Recommendation                                                                                                   |
| ----- | ------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------- |
| OQ-06 | Should `audit_log` capture read access, or only writes?                                    | Writes always; report _generation_ also audited (REP-COM-06); ad-hoc reads not logged — volume vs value tradeoff |
| OQ-07 | Is there a maximum number of accounts per customer?                                        | No stated limit in brief/SRS; leave unconstrained, revisit if abuse becomes a concern                            |
| OQ-09 | Should closed accounts be excluded from reports by default, or shown with a status column? | Shown with a status column — hiding history breaks reconciliation                                                |
| OQ-10 | Does `customer_document` need file storage, or just metadata (type, number, expiry)?       | Metadata only — no file upload requirement anywhere in the brief or SRS                                          |

> **Numbering warning:** `docs/02_srs-summary.md` §TBD table uses OQ-06, OQ-07, OQ-09 and
> OQ-10 for _different_ questions (FD maturity, withdrawal limits, hosting, submission
> artifacts). This file is the authority for OQ numbers; the SRS table needs reconciling.

## New items raised by the 2026-10-02 decisions

| ID    | Question                                                                                                                                                    | Needed before                |
| ----- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------- |
| OQ-11 | How does a newly registered customer receive their first credential (temporary password, forced change, invite)?                                            | P02 customer registration UI |
| OQ-12 | Transfer transaction typing: one `TRANSFER` type with direction, or separate out/in types?                                                                  | P03 `transaction` schema     |
| OQ-13 | Does an account opened or closed mid-cycle earn interest for the days it was open? (assumed yes)                                                            | P04 `sp_run_interest_cycle`  |
| OQ-14 | Does the lecturer accept customer self-service and transfers, given the SRS says self-service is "limited to inquiry functions" and transfers out of scope? | Before Phase 3               |

## Resolved

### P02-M02-T01 source/documentation reconciliation — 2026-10-05

The user approved Phase 2 entry earlier in this conversation and explicitly requested
customer-schema implementation. The clean checkout at 3fe8689 still has older TODO/
Phase 0 headers and no earlier uncommitted closeout files. The restored historical
checkpoint records approval without claiming those absent repairs are integrated.
This task proceeds under the user's retained authorization; other task statuses are
not recertified by the customer-schema change.

Part B.4 is expanded to match the approved task card's customer_number, lifecycle,
required fields and timestamps. The card's example schema_migration(version,name)
insert is corrected: the actual runner records filename/checksum. No new identity
decision is needed; ADR-0007 remains authoritative.


### OQ-05 — Customer login is optional

- **Resolved:** 2026-09-29
- **Decision:** Customers are primarily agent-managed and may exist without a login.
  `customer` receives an independent surrogate `customer_id`; an optional unique
  `app_user_id` links only customers who are later granted self-service access.
- **Effect:** G-20 and TBD-02 are resolved. `P02-M02-T01` is no longer blocked by the
  customer identity decision, but Phase 2 still requires its normal entry checkpoint.
- **Record:** `.agent/decisions/ADR-0007-optional-customer-login.md`.

### OQ-01 — Second FD after the first closes? — **2026-10-02**

One **active** FD per savings account; a new one is allowed after the previous matures or
closes. Partial unique index on `status = 'ACTIVE'` replaces the ERD's plain `UNIQUE`.
→ [ADR-0011](decisions/ADR-0011-one-active-fd-per-account.md)

### OQ-04 — Do savings accounts accrue interest? — **2026-10-02**

Yes. The 30-day cycle processes both savings accounts and FDs. Savings interest uses
**average daily balance** over the cycle, actual/365. `interest_payout` gains `account_id`
and `source_type`; `fd_id` becomes nullable.
→ [ADR-0012](decisions/ADR-0012-savings-interest-average-daily-balance.md)

### OQ-08 — Do inter-account transfers exist? — **2026-10-02**

Yes. Each ledger row keeps a unique `reference_number`; a nullable `transfer_group_id`
links the debit and credit legs. ERD Assumption 4 is dropped.
→ [ADR-0010](decisions/ADR-0010-transfers-with-transfer-group.md)


## How to resolve one

1. Discuss with the group (and the lecturer, if flagged as a lecturer question).
2. Move the entry to **Resolved** with the decision and date.
3. If it affects schema, architecture, or a cross-member contract: write an ADR in
   `decisions/`.
4. If it unblocks a task, update that task's status in `docs/09_task-tracker.md`.
