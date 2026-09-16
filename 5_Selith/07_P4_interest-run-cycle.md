# 🟠 Phase 4 — Member 5 Tasks (Part 2): Interest Run Cycle, FD Pages & Console
**Task IDs:** `P04-M05-T04`, `P04-M05-T05`  
**Migration Block:** `0480–0499` (continued)  
**Depends on:** P04-M05-T03 (`fn_calculate_fd_interest`), **I-5** (M4's `INTEREST_CREDIT` posting)  
**Story Points:** ~8 total · **Layer:** Database + Backend + Frontend  
**⚡ The interest cycle is the most complex single procedure in the system**

---

## Overview

This is the second half of Phase 4. You build the interest run infrastructure (`interest_run`, `interest_payout`, `sp_run_interest_cycle`) and then the UI: FD opening page, FD listing, and the **interest run console**.

---

## Task 4: Interest Run & Cycle Procedure (`P04-M05-T04`)
**Branch:** `feat/p04-m05-interest-cycle`  
**Depends on:** P04-M05-T03, **I-5** (M4's ledger routine)

### Tables to Create

#### `interest_run`
One row per 30-day cycle. The control record.

| Column | Type | Constraints |
|---|---|---|
| `run_id` | `uuid` DEFAULT `gen_random_uuid()` | **PK** |
| `cycle_date` | `date` | **UNIQUE**, NOT NULL — prevents duplicate runs (BR-15, G-03) |
| `started_at` | `timestamptz` | NOT NULL DEFAULT `now()` |
| `completed_at` | `timestamptz` | NULL until the run finishes |
| `status` | `varchar(20)` | `RUNNING` / `COMPLETED` / `FAILED` |
| `fd_count` | `int` | Total FDs processed |
| `total_interest` | `numeric(15,2)` | Total interest distributed |
| `exception_count` | `int` | FDs that failed |
| `initiated_by` | `uuid` | FK → `app_user` (NULL for SYSTEM — G-22) |
| `created_at` | `timestamptz` | NOT NULL DEFAULT `now()` |

#### `interest_payout`
One row per FD per cycle. Links the FD to its `INTEREST_CREDIT` ledger entry.

| Column | Type | Constraints |
|---|---|---|
| `interest_id` | `uuid` DEFAULT `gen_random_uuid()` | **PK** |
| `fd_id` | `uuid` | **FK → fixed_deposit**, NOT NULL |
| `interest_run_id` | `uuid` | **FK → interest_run**, NOT NULL |
| `transaction_id` | `uuid` | **FK → transaction, UNIQUE** — one ledger row per payout |
| `cycle_date` | `date` | NOT NULL |
| `payout_date` | `date` | NOT NULL |
| `interest_amount` | `numeric(15,2)` | NOT NULL |
| `created_at` | `timestamptz` | NOT NULL DEFAULT `now()` |

**Critical constraint:**
```sql
-- Prevents paying the same FD twice for the same cycle (BR-F2, NFR-SAFE-03)
CREATE UNIQUE INDEX uq_payout_fd_cycle
    ON interest_payout(fd_id, cycle_date);
```

### Migration (`0482_p04_m05_interest_run.sql`)

```sql
BEGIN;

CREATE TABLE interest_run (
    run_id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    cycle_date      date NOT NULL UNIQUE,
    started_at      timestamptz NOT NULL DEFAULT now(),
    completed_at    timestamptz,
    status          varchar(20) NOT NULL DEFAULT 'RUNNING'
                    CHECK (status IN ('RUNNING', 'COMPLETED', 'FAILED')),
    fd_count        int DEFAULT 0,
    total_interest  numeric(15,2) DEFAULT 0,
    exception_count int DEFAULT 0,
    initiated_by    uuid REFERENCES app_user(user_id),
    created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE interest_payout (
    interest_id     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    fd_id           uuid NOT NULL REFERENCES fixed_deposit(fd_id) ON DELETE RESTRICT,
    interest_run_id uuid NOT NULL REFERENCES interest_run(run_id) ON DELETE RESTRICT,
    transaction_id  uuid UNIQUE REFERENCES transaction(transaction_id) ON DELETE RESTRICT,
    cycle_date      date NOT NULL,
    payout_date     date NOT NULL,
    interest_amount numeric(15,2) NOT NULL,
    created_at      timestamptz NOT NULL DEFAULT now()
);

-- Idempotency: same FD cannot be paid twice for same cycle
CREATE UNIQUE INDEX uq_payout_fd_cycle
    ON interest_payout(fd_id, cycle_date);

INSERT INTO schema_migration(version, name)
VALUES (482, '0482_p04_m05_interest_run');

COMMIT;
```

### Procedure: `sp_run_interest_cycle`

This is the most complex procedure in the system. **Key design point:** one transaction per FD, not one per run (FR-INT-04).

```sql
CREATE OR REPLACE FUNCTION sp_run_interest_cycle(
    p_cycle_date  date,
    p_user_id     uuid DEFAULT NULL  -- NULL for system/worker
) RETURNS uuid AS $$
DECLARE
    v_run_id        uuid;
    v_fd            RECORD;
    v_interest      numeric(15,2);
    v_fd_count      int := 0;
    v_total         numeric(15,2) := 0;
    v_exceptions    int := 0;
    v_txn_id        uuid;
BEGIN
    -- 1. Create the run record (UNIQUE on cycle_date prevents duplicates)
    INSERT INTO interest_run (cycle_date, status, initiated_by)
    VALUES (p_cycle_date, 'RUNNING', p_user_id)
    RETURNING run_id INTO v_run_id;

    -- 2. Find all active FDs due for interest on this cycle date
    FOR v_fd IN
        SELECT fd_id, account_id, principal_amount,
               interest_rate_at_opening, next_interest_date
        FROM fixed_deposit
        WHERE status = 'ACTIVE'
          AND next_interest_date <= p_cycle_date
    LOOP
        BEGIN  -- nested block for per-FD error handling
            -- 3. Calculate interest using the snapshot rate
            v_interest := fn_calculate_fd_interest(
                v_fd.principal_amount,
                v_fd.interest_rate_at_opening
            );

            -- 4. Post the INTEREST_CREDIT through M4's ledger routine (I-5)
            --    This creates the transaction row and updates the balance
            v_txn_id := sp_post_interest_credit(
                v_fd.account_id, v_interest, v_run_id
            );

            -- 5. Record the payout
            INSERT INTO interest_payout (
                fd_id, interest_run_id, transaction_id,
                cycle_date, payout_date, interest_amount
            ) VALUES (
                v_fd.fd_id, v_run_id, v_txn_id,
                p_cycle_date, CURRENT_DATE, v_interest
            );

            -- 6. Advance next_interest_date by 30 days
            UPDATE fixed_deposit
            SET next_interest_date = next_interest_date + interval '30 days',
                updated_at = now()
            WHERE fd_id = v_fd.fd_id;

            v_fd_count := v_fd_count + 1;
            v_total := v_total + v_interest;

        EXCEPTION WHEN OTHERS THEN
            -- Per-FD failure: log it, don't abort the run
            v_exceptions := v_exceptions + 1;
            RAISE WARNING 'Interest payout failed for FD %: %',
                v_fd.fd_id, SQLERRM;
        END;
    END LOOP;

    -- 7. Finalize the run
    UPDATE interest_run
    SET status = 'COMPLETED',
        completed_at = now(),
        fd_count = v_fd_count,
        total_interest = v_total,
        exception_count = v_exceptions
    WHERE run_id = v_run_id;

    RETURN v_run_id;
END;
$$ LANGUAGE plpgsql;
```

### Why One Transaction Per FD

> FR-INT-04: a failed distribution must roll back **without affecting FDs already processed**.

If you wrap the whole run in one transaction and FD #47 fails, FDs #1–46 are rolled back too. By using a nested `BEGIN...EXCEPTION` block per FD (or separate transactions in the service layer), each FD's payout is independently committed.

### Tests for Task 4

| Test | What it verifies |
|---|---|
| Run with 3 due FDs → 3 payouts, correct totals | Happy path |
| Re-run same cycle date → `23505` on `interest_run` | Cycle idempotency (BR-15) |
| Same FD + same cycle date → `23505` on `interest_payout` | Payout idempotency (BR-F2) |
| One FD fails → others still processed, `exception_count = 1` | FR-INT-04 |
| `next_interest_date` advances by 30 days | Cycle advancement |
| `total_interest` matches SUM of individual payouts | Reconciliation |
| FD with `status != 'ACTIVE'` is skipped | Only active FDs processed |
| Interest credited to the linked savings account balance | Balance update |

---

## Task 5: FD Pages & Interest Run Console (`P04-M05-T05`)
**Branch:** `feat/p04-m05-fd-pages`  
**Depends on:** P04-M05-T04, **I-1** (M1's RBAC)

### APIs to Create

| Endpoint | Method | Purpose | Roles |
|---|---|---|---|
| `/api/fixed-deposits` | `GET` | List FDs (branch-scoped) | AGENT, BRANCH_MANAGER, ADMIN |
| `/api/fixed-deposits` | `POST` | Open a new FD | AGENT, BRANCH_MANAGER |
| `/api/fixed-deposits/[id]` | `GET` | FD detail | AGENT, BRANCH_MANAGER, ADMIN |
| `/api/interest-runs` | `GET` | List past runs | CENTRAL_OPS, ADMIN |
| `/api/interest-runs` | `POST` | Trigger a run | CENTRAL_OPS, ADMIN, worker token |

### Frontend Pages

#### FD Opening Page (`app/fixed-deposits/new/page.tsx`)
- Account selector (search by number or customer)
- FD plan selector (shows tenure, rate, description)
- Principal amount input (validated: positive, ≤ account balance)
- **Preview panel:** shows maturity date and estimated first interest payout
- Submit button → calls `POST /api/fixed-deposits`

#### FD Listing (`app/fixed-deposits/page.tsx`)
- Data table: FD ID, account, plan, principal, rate, start, maturity, next payout, status
- Filters: status, plan type, branch
- Branch-scoped for BRANCH_MANAGER

#### Interest Run Console (`app/interest-runs/page.tsx`)
- **Past runs table:** cycle date, status, FD count, total interest, exceptions, initiated by
- **Trigger button:** starts a new interest run (CENTRAL_OPS/ADMIN only)
- **Progress indicator:** shows running state
- **Exception details:** expandable rows for failed payouts

### Tests for Task 5

| Test | What it verifies |
|---|---|
| `POST /api/fixed-deposits` creates FD, debits balance | End-to-end FD opening |
| Non-authenticated → `401` | Auth required |
| CUSTOMER role → `403` | Not authorized to open FD |
| AGENT can open FD → `200` | Authorized role |
| `POST /api/interest-runs` by CENTRAL_OPS → run executes | Run trigger |
| `POST /api/interest-runs` by AGENT → `403` | Not authorized |

### Update Docs
- Update `docs/05_api-and-pages.md` with FD and interest run endpoints
- Run `/imprint` and update `ui-registry.md`
- Update task status in `docs/09_task-tracker.md` → `DONE`
- Write handoff if M3 needs the FD status for the account closure rule

---

## Acceptance Criteria (Tasks 4 + 5)
- [ ] `interest_run` with `UNIQUE(cycle_date)` prevents duplicate runs
- [ ] `interest_payout` with `UNIQUE(fd_id, cycle_date)` prevents duplicate payouts
- [ ] Interest credits post through M4's ledger routine as `INTEREST_CREDIT`
- [ ] One failing FD does not roll back completed distributions
- [ ] Run records `fd_count`, `total_interest`, `exception_count`
- [ ] `next_interest_date` advances by 30 days per payout
- [ ] FD opening page, FD listing, and interest run console are functional
- [ ] Only CENTRAL_OPS and ADMIN can trigger interest runs
