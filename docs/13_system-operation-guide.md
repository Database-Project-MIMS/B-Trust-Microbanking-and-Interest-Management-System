# 13 — System Operation Guide

How to operate and demonstrate MIMS. Written so a QA tester or an examiner can follow it
without asking anyone.

Setup first: `10_local-setup.md`.

---

## Demonstration credentials

Synthetic, development only. Loaded by `database/seed/01_roles_users.sql`.

| Role | Username | Demonstrates |
|---|---|---|
| `ADMIN` | `admin` | Users, roles, parameters, audit |
| `CENTRAL_OPS` | `ops.central` | FD products, interest runs, bank-wide reports |
| `BRANCH_MANAGER` | `mgr.colombo` | Branch scope, mandates, **reversals** |
| `AGENT` | `agent.colombo1` | Customers, accounts, deposits, withdrawals |
| `AGENT` | `agent.kandy1` | Cross-branch denial testing |
| `AUDITOR` | `auditor` | Read-only reports and audit |
| `CUSTOMER` | `cust.demo` | Self-service scope (subject to **OQ-05**) |

Passwords are in the seed file header. **Never reuse them anywhere real.**

## Signing in

`http://localhost:3000` → `/sign-in`. Note what happens on a wrong password: the message is
identical whether or not the username exists, and five failures throttle (FR-AUTH-03).

## Registering a customer

1. Sign in as `agent.colombo1` → **Customers** → **Register customer**.
2. Enter identity, date of birth, contact and address; attach a document type; the branch
   and agent default to yours.
3. Submit. The customer, documents, agent assignment and audit event are inserted in
   **one transaction** (§4.3).

**Worth demonstrating:** submit the same NIC twice — the second is rejected with
`DUPLICATE_IDENTITY` from a unique constraint, and **no partial customer row is left
behind**.

## Opening a savings account

### Individual

1. **Accounts** → **Open account** → select the customer.
2. Choose a plan. Age determines eligibility, read from `savings_plan` data.
3. Enter an opening amount at or above the plan minimum. Submit.

**Worth demonstrating:** try Children for an adult, or Adult for a 15-year-old — rejected
by `fn_check_plan_eligibility`, which reads age bounds from the table rather than
hardcoding plan names. Try an opening amount below the minimum — rejected.

### Joint

1. Same flow, plan **Joint**. Add 2–4 holders, all adults.
2. Choose a mandate: `ANY_ONE` or `ALL_HOLDERS`. Minimum LKR 5,000.

**Worth demonstrating:** try 1 holder, or 5 — both rejected by
`trg_validate_joint_mandate`, a statement-level trigger, because holder count is a rule
that spans rows and cannot be a row-level `CHECK`.

## Deposits

**Transactions** → **Deposit** → account, amount, channel → confirm.

The receipt shows the reference number, amount and new balance.

**Worth demonstrating (idempotency):** replay the request with the same `Idempotency-Key`:

```bash
curl -X POST localhost:3000/api/transactions/deposits \
  -H 'Idempotency-Key: demo-key-001' -H 'Content-Type: application/json' \
  --cookie "$COOKIE" -d '{"accountId":"...","amount":"5000.00","channelId":"..."}'
```

Run it twice. The second returns the **original** transaction and the balance moves once —
guaranteed by a partial unique index, not by application memory (FR-DEP-04, AC-06).

## Withdrawals

**Transactions** → **Withdraw**.

**Worth demonstrating, in this order:**

1. A valid withdrawal succeeds; the balance drops.
2. A withdrawal that would breach the plan minimum → `BELOW_MINIMUM_BALANCE`, **no ledger
   row created**.
3. A withdrawal larger than the balance → `INSUFFICIENT_FUNDS`. An overdraft is impossible
   (NFR-SAFE-01).
4. **Concurrency:** two simultaneous withdrawals of 600 against a balance of 1,000 —
   exactly one succeeds. Run `tests/db/concurrency.test.mjs`. This is AC-06 and the single
   most convincing thing to show a database examiner.

## Reversal

Sign in as `mgr.colombo` (agents cannot do this — try it and get `403`). Open a
transaction → **Reverse** → give a reason.

The original row is **unchanged and still visible**; a linked compensating entry appears
and the balance is restored. Reverse the same transaction twice — rejected by a unique
constraint (DB-CON-04).

## Fixed deposits

1. **Fixed Deposits** → **Open FD** → an active savings account with sufficient balance.
2. Choose 6-month/13%, 1-year/14% or 3-year/15%. Enter the principal.
3. Submit — the principal is debited and the FD created in one transaction.

The FD shows start date, maturity date, next interest date, and the **rate snapshot taken
at opening**.

**Worth demonstrating:** open a second FD on the same account → `ACTIVE_FD_EXISTS`,
enforced by a partial unique index (AC-08).

## Interest run

Sign in as `ops.central` → **Interest Runs** → **Run cycle** with a cycle date.

The console reports FDs processed, total interest and exceptions. Each credit appears in
its linked savings account as a **separate `INTEREST_CREDIT` transaction** (FR-INT-02).

**Worth demonstrating:** run the **same cycle date again** → `RUN_ALREADY_EXISTS`, zero new
payouts, zero new ledger rows. This is NFR-SAFE-03 and AC-08 — the interest job cannot
double-pay even if manually re-run or interrupted.

Spot-check the arithmetic: LKR 100,000 at 14% → `100000 × 0.1400 × 30 / 365` = **LKR
1,150.68**, exact decimal.

## Reports

**Reports** → pick one of five. Set filters, generate, then **Export CSV**.

| Report | Show |
|---|---|
| RPT-01 Agent-wise | Totals differ per agent; totals reconcile to the ledger |
| RPT-02 Account-wise | Opening and closing balance; counts by type |
| RPT-03 Active FDs | Next payout dates advance after an interest run |
| RPT-04 Monthly interest | Subtotals by account type, using `ROLLUP` |
| RPT-05 Customer activity | Net = deposits − withdrawals + interest |

**Worth demonstrating:** sign in as `mgr.colombo` and run RPT-01 — only Colombo rows
appear, because the branch predicate is in the SQL (REP-COM-02). Then confirm the CSV
totals match the screen exactly (REP-COM-04).

## Administration

- **Users and roles** — create, deactivate. Records referenced by the ledger cannot be
  deleted (FR-ORG-05).
- **Parameters** — business hours and withdrawal limits are **data**. Change the closing
  time and watch a deposit be refused outside hours (BR-08).
- **Audit search** — filter by actor, entity, action and date. Try editing an audit row
  directly in `psql`: the trigger rejects it.
- **Health** — `/admin/health` shows database connectivity and pool stats.

## Reset for a clean demonstration

```bash
npm run db:rebuild     # drop, migrate, routines, triggers, views, indexes, roles, seed
npm run db:verify      # all checks must pass
npm run dev
```

Deterministic, so report totals are identical every time you demonstrate. If `db:rebuild`
fails, that is a defect — fix the migration, never patch the database by hand (SRS §6.8).

## Ten-minute demonstration script

1. Sign in as an agent; register a customer; show the duplicate-NIC rejection. **(1 min)**
2. Open an individual account; show an eligibility rejection. **(1 min)**
3. Open a joint account; show the holder-count trigger rejecting 1 holder. **(1.5 min)**
4. Deposit; then replay with the same idempotency key — balance moves once. **(1.5 min)**
5. Withdrawal rejected at the minimum balance; then the concurrency test. **(1.5 min)**
6. Manager reverses a transaction; original preserved; second reversal rejected. **(1 min)**
7. Open an FD; second FD on the same account rejected. **(1 min)**
8. Run an interest cycle; re-run it; no duplicate. **(1.5 min)**
9. Two reports with matching CSV; branch scoping as a manager. **(1 min)**

Every step demonstrates a **database** guarantee, not a UI behaviour. That is the point.
