# Open Questions

Raised during Phase 0 while reconciling the brief, SRS and ERD. Each entry says what it
blocks so nobody discovers the dependency by surprise.

## Blocking (must resolve before the phase noted can *finish*)

### OQ-01 — Does a customer's account ever get a second FD, after the first matures/closes?
- **Ties to:** ERD gap G-01. ERD has `UNIQUE(account_id)` on `fixed_deposit` — one FD per
  account, ever. SRS implies only one FD *active* at a time is restricted.
- **Blocks:** `P04-M05-T0x` (fixed_deposit schema) — determines a plain `UNIQUE` vs a
  partial unique index `WHERE status = 'ACTIVE'`.
- **Recommendation:** partial unique index (one active at a time, subsequent FDs allowed
  after maturity/closure). This matches ordinary microfinance product behaviour and the
  SRS's use of "active."
- **Status:** OPEN — needs sign-off, not lecturer-blocking, safe to decide internally.

### OQ-04 — Do savings accounts (not just FDs) accrue interest?
- **Ties to:** ERD gap G-12. `interest_payout.fd_id` is NOT NULL in the ERD — structurally
  no room for savings-account interest — yet the brief gives explicit rates to all five
  savings plans, and RPT-04 asks for distribution "by account type."
- **Blocks:** `P04-M05-T0x` (interest_payout schema), `P04-M05-T0x`
  (`sp_run_interest_cycle` scope), size of the entire Phase 4.
- **Recommendation:** ask the lecturer directly — this is a scope question about the
  assignment, not an engineering judgment call. If forced to guess without an answer: FDs
  only, since that is what the ERD explicitly supports and the brief's "Interest
  Management System" name leans FD-first.
- **Status:** OPEN — **lecturer question**, flagged in `docs/17_erd-gap-analysis.md`.

### OQ-05 — Does every customer require a login, or are some customers agent-managed only?
- **Ties to:** ERD gap G-20. `customer.customer_id` is `PK,FK` to `app_user` in the ERD,
  forcing a login for every customer. SRS TBD-02 asks the same question and leaves it open.
- **Blocks:** `P02-M02-T01` (customer schema) — this is the customer table's primary key
  strategy, so it cannot be built provisionally and revised later without a migration that
  touches every downstream FK.
- **Recommendation:** decouple — give `customer` its own PK, with an *optional* FK to
  `app_user` for the subset who get a portal login. Matches how real microfinance
  operations work (most customers are walk-in, agent-mediated).
- **Status:** OPEN — decide before Phase 2 starts, doesn't need the lecturer.

### OQ-08 — Do inter-account transfers exist as a transaction type?
- **Ties to:** ERD gap G-05. ERD Assumption 4 says a transfer's two legs share one
  `reference_number`; BR-10 says reference numbers are unique. Both cannot be true if
  transfers exist as specified. Neither the brief nor the SRS's five reports mention
  transfers.
- **Blocks:** `P03-M04-T0x` (`transaction` schema — determines whether
  `reference_number` gets a bare `UNIQUE` or a `UNIQUE(reference_number, leg_sequence)`).
- **Recommendation:** transfers are out of scope. Deposits, withdrawals, interest credits
  and reversals only. Drop ERD Assumption 4, keep `reference_number` uniquely constrained.
  If transfers turn out to be required, this is a small additive migration, not a rework.
- **Status:** OPEN — safe to decide internally; revisit only if the lecturer says
  otherwise.

## Non-blocking (approve when convenient, nothing is waiting on these)

| ID | Question | Recommendation |
|---|---|---|
| OQ-06 | Should `audit_log` capture read access, or only writes? | Writes always; report *generation* also audited (REP-COM-06); ad-hoc reads not logged — volume vs value tradeoff |
| OQ-07 | Is there a maximum number of accounts per customer? | No stated limit in brief/SRS; leave unconstrained, revisit if abuse becomes a concern |
| OQ-09 | Should closed accounts be excluded from reports by default, or shown with a status column? | Shown with a status column — hiding history breaks reconciliation |
| OQ-10 | Does `customer_document` need file storage, or just metadata (type, number, expiry)? | Metadata only — no file upload requirement anywhere in the brief or SRS |

## Resolved

*(none yet — this section fills in as decisions are made; each resolution should also
become an ADR in `decisions/` if it affects schema or architecture)*

## How to resolve one

1. Discuss with the group (and the lecturer, if flagged as a lecturer question).
2. Move the entry to **Resolved** with the decision and date.
3. If it affects schema, architecture, or a cross-member contract: write an ADR in
   `decisions/`.
4. If it unblocks a task, update that task's status in `docs/09_task-tracker.md`.
