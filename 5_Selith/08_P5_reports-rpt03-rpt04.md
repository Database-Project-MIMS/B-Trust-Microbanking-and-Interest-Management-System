# 🟠 Phase 5 — Member 5 Tasks: RPT-03, RPT-04, Index Review
**Task IDs:** `P05-M05-T01`, `P05-M05-T02`, `P05-M05-T03`, `P05-M05-T04`  
**Migration Block:** `0580–0599`  
**Story Points:** ~12 total · **Layer:** Database + Backend + Frontend  
**Depends on:** P04-M05-T02, P04-M05-T04, **I-7** (M1's report framework)

---

## Overview

Phase 5 is your **second heaviest phase** (12 points). You build two report views, their APIs and pages, and then conduct the `EXPLAIN ANALYZE` performance review across all reports. Your reports plug into M1's report framework (I-7).

---

## Task 1: RPT-03 View — Active FDs and Next Payout (`P05-M05-T01`)
**Branch:** `feat/p05-m05-rpt03-view`  
**Depends on:** P04-M05-T02

### What to Do

Create the database view that powers RPT-03: a listing of all active fixed deposits with their holders, principal, product details, and next payout date.

### View: `vw_rpt03_active_fds`

```sql
CREATE OR REPLACE VIEW vw_rpt03_active_fds AS
SELECT
    fd.fd_id,
    fd.account_id,
    a.account_number,
    a.branch_id,                          -- for branch-scope filtering
    b.branch_name,
    fd.fd_plan_id,
    fp.plan_name                          AS product_name,
    fp.tenure_months,
    fd.principal_amount,
    fd.interest_rate_at_opening,          -- snapshot rate, not plan rate
    fd.start_date,
    fd.maturity_date,
    fd.next_interest_date,
    fd.status                             AS fd_status,
    -- Holder information (aggregated)
    string_agg(c.full_name, ', ' ORDER BY ah.joined_date) AS holder_names,
    COUNT(ah.account_holder_id)           AS holder_count,
    -- Calculated fields
    fn_calculate_fd_interest(
        fd.principal_amount,
        fd.interest_rate_at_opening
    )                                     AS estimated_next_payout
FROM fixed_deposit fd
JOIN account a ON a.account_id = fd.account_id
JOIN branch b ON b.branch_id = a.branch_id
JOIN fd_plan fp ON fp.fd_plan_id = fd.fd_plan_id
LEFT JOIN account_holder ah ON ah.account_id = a.account_id
LEFT JOIN customer c ON c.customer_id = ah.customer_id
WHERE fd.status = 'ACTIVE'
GROUP BY fd.fd_id, fd.account_id, a.account_number, a.branch_id,
         b.branch_name, fd.fd_plan_id, fp.plan_name, fp.tenure_months,
         fd.principal_amount, fd.interest_rate_at_opening,
         fd.start_date, fd.maturity_date, fd.next_interest_date, fd.status;
```

### Required Content (from Phase 5 spec)

| Column | Source |
|---|---|
| FD ID | `fixed_deposit.fd_id` |
| Account number | `account.account_number` |
| Holder names | Aggregated from `customer.full_name` |
| Principal | `fixed_deposit.principal_amount` |
| Product name | `fd_plan.plan_name` |
| Rate at opening | `fixed_deposit.interest_rate_at_opening` |
| Start date | `fixed_deposit.start_date` |
| Maturity date | `fixed_deposit.maturity_date` |
| Next payout date | `fixed_deposit.next_interest_date` |
| Status | `fixed_deposit.status` |

**SQL technique:** Joins + date arithmetic (L05)

---

## Task 2: RPT-04 View — Monthly Interest Distribution (`P05-M05-T02`)
**Branch:** `feat/p05-m05-rpt04-view`  
**Depends on:** P04-M05-T04

### What to Do

Create the database view for RPT-04: monthly interest distribution breakdown by account type/savings plan, using **`ROLLUP` or `GROUPING SETS`** (L13 — this is a graded SQL technique).

### View: `vw_rpt04_interest_distribution`

```sql
CREATE OR REPLACE VIEW vw_rpt04_interest_distribution AS
SELECT
    ir.cycle_date,
    EXTRACT(YEAR FROM ir.cycle_date)    AS cycle_year,
    EXTRACT(MONTH FROM ir.cycle_date)   AS cycle_month,
    sp.plan_name                        AS savings_plan_name,
    fp.plan_name                        AS fd_product_name,
    a.branch_id,
    b.branch_name,
    COUNT(ip.interest_id)               AS distribution_count,
    SUM(ip.interest_amount)             AS total_interest,
    AVG(ip.interest_amount)             AS avg_interest,
    MIN(ip.interest_amount)             AS min_interest,
    MAX(ip.interest_amount)             AS max_interest
FROM interest_payout ip
JOIN interest_run ir ON ir.run_id = ip.interest_run_id
JOIN fixed_deposit fd ON fd.fd_id = ip.fd_id
JOIN fd_plan fp ON fp.fd_plan_id = fd.fd_plan_id
JOIN account a ON a.account_id = fd.account_id
JOIN branch b ON b.branch_id = a.branch_id
JOIN savings_plan sp ON sp.plan_id = a.plan_id
GROUP BY ROLLUP (
    (ir.cycle_date, EXTRACT(YEAR FROM ir.cycle_date), EXTRACT(MONTH FROM ir.cycle_date)),
    (sp.plan_name),
    (fp.plan_name),
    (a.branch_id, b.branch_name)
);
```

**Why `ROLLUP`/`GROUPING SETS`?**
- This is explicitly called out in the Phase 5 specification as the required SQL technique (L13)
- It produces subtotals at each grouping level automatically
- Grand totals are included as rows where the grouped column is NULL
- **This demonstrates advanced SQL skills for grading**

### Alternative using `GROUPING SETS`

```sql
GROUP BY GROUPING SETS (
    (ir.cycle_date, sp.plan_name, fp.plan_name, a.branch_id, b.branch_name),  -- detail
    (ir.cycle_date, sp.plan_name, fp.plan_name),                               -- subtotal by product
    (ir.cycle_date, sp.plan_name),                                              -- subtotal by savings plan
    (ir.cycle_date),                                                            -- subtotal by cycle
    ()                                                                          -- grand total
)
```

### Required Content (from Phase 5 spec)

| Column | Source |
|---|---|
| Cycle date | `interest_run.cycle_date` |
| Product/account type | `fd_plan.plan_name` / `savings_plan.plan_name` |
| Distribution count | `COUNT(interest_payout)` |
| Total interest | `SUM(interest_amount)` |
| Exception count | `interest_run.exception_count` |

---

## Task 3: RPT-03 & RPT-04 APIs, Pages, and CSV (`P05-M05-T03`)
**Branch:** `feat/p05-m05-report-pages`  
**Depends on:** P05-M05-T02, **I-7** (M1's report framework)

### API Endpoints

Both reports use M1's report framework pattern:

```typescript
// app/api/reports/active-fds/route.ts
export async function GET(request: Request) {
  const user = await requireUser(request);
  requireRole(user, 'BRANCH_MANAGER', 'CENTRAL_OPS', 'AUDITOR', 'ADMIN');
  
  const scope = branchScope(user);
  const filters = parseReportFilters(request.url);
  
  // Query the view with branch scope in SQL WHERE
  const result = await getActiveFdsReport(filters, scope);
  
  // Audit the access (REP-COM-06)
  await auditReportAccess(user, 'RPT-03', filters);
  
  if (filters.format === 'csv') {
    return streamCsv(result);
  }
  return Response.json({ data: result });
}
```

### RPT-03 Filters
- Date range (start/maturity date)
- Branch (auto-scoped for branch managers)
- FD product type
- Status (ACTIVE/MATURED/CLOSED)

### RPT-04 Filters
- Date range (cycle date)
- Branch
- Savings plan type
- FD product type

### Frontend Pages

#### RPT-03 Page (`app/reports/active-fds/page.tsx`)
Using M1's report shell components:
- **Filter bar:** date range, branch, product, status
- **Data table:** all active FDs with details
- **Subtotals:** total principal by product type
- **Grand total:** total principal, estimated next payout
- **CSV export button**
- **Metadata:** generation timestamp, requesting user

#### RPT-04 Page (`app/reports/interest-distribution/page.tsx`)
- **Filter bar:** cycle date range, branch, plan type
- **Data table:** distribution details with `ROLLUP` subtotals
- **Subtotals:** by product, by savings plan, by cycle
- **Grand total:** total interest distributed
- **CSV export button**

### Report Non-Negotiables (REP-COM-*)
- [ ] Title, filters, timestamp, requesting user displayed (REP-COM-01)
- [ ] Branch scope in SQL WHERE (REP-COM-02)
- [ ] Detail rows + subtotals + grand total (REP-COM-03)
- [ ] CSV uses same query, same totals (REP-COM-04)
- [ ] Paginated or streamed (REP-COM-05)
- [ ] Access audited (REP-COM-06)

---

## Task 4: Index Review with `EXPLAIN ANALYZE` (`P05-M05-T04`)
**Branch:** `feat/p05-m05-explain-analyze`  
**Depends on:** P05-M05-T03

### What to Do

Run `EXPLAIN ANALYZE` on **every report query** (not just yours — all five reports) and collect evidence that they use **index scans, not sequential scans** on the `transaction` table.

### How to Implement

Create `database/indexes/explain-analyze-evidence.md`:

```markdown
# EXPLAIN ANALYZE Evidence

## RPT-01: Agent-wise Transactions
### Query
(paste the actual query)
### Before Index
(paste EXPLAIN ANALYZE output showing Seq Scan)
### After Index
(paste EXPLAIN ANALYZE output showing Index Scan)
### Index Created
`CREATE INDEX ix_... ON transaction(...)`

## RPT-02: Account-wise Summary
...

## RPT-03: Active FDs
...

## RPT-04: Interest Distribution
...

## RPT-05: Customer Activity
...
```

### Evidence Requirements
For each report:
1. Run `EXPLAIN ANALYZE` with realistic seed data (100+ transactions)
2. Verify **index scans** (not sequential scans) on large tables
3. If a sequential scan is found, create a new index to fix it
4. Document the before/after in the evidence file
5. Each report must complete within **5 seconds** on the sample dataset (NFR-PERF-03)

### Indexes to Verify/Create

| Index | Table | Purpose | Report |
|---|---|---|---|
| `ix_fd_due_interest` | `fixed_deposit` | Status + next interest date | RPT-03 |
| `ix_payout_cycle` | `interest_payout` | Cycle date lookups | RPT-04 |
| `ix_txn_account_date` | `transaction` | Account + date for statements | RPT-02, RPT-05 |
| `ix_txn_agent_date` | `transaction` | Agent + date for agent report | RPT-01 |

---

## Acceptance Criteria (All 4 Tasks)
- [ ] RPT-03 shows active FDs with holders, principal, rates, and next payout
- [ ] RPT-04 uses `ROLLUP` or `GROUPING SETS` for subtotals (L13 technique)
- [ ] Both reports work with branch scope, CSV export, and audit logging
- [ ] Grand totals reconcile with the underlying data
- [ ] CSV totals match screen totals exactly
- [ ] `EXPLAIN ANALYZE` evidence collected for all 5 reports
- [ ] No sequential scans on `transaction` — all use index scans
- [ ] All reports complete within 5 seconds (NFR-PERF-03)
