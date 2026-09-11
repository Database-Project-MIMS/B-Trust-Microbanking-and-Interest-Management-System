# 🟠 Phase 5 — Member 1 Tasks: Report Framework, CSV, Audit Search
**Task IDs:** `P05-M01-T01`, `P05-M01-T02`, `P05-M01-T03`, `P05-M01-T04`  
**Migration Block:** `0500–0519`  
**Story Points:** ~12 total · **Layer:** Backend + Frontend + Database  
**⚡ Publishes Integration Point I-7 — All report owners depend on this**

---

## Overview

Phase 5 is your **heaviest phase** (12 points). You build the shared reporting framework that all 5 reports plug into, the CSV export utility, report access auditing, and the audit search page.

---

## Task 1: Report Framework (`P05-M01-T01`) — CRITICAL
**Branch:** `feat/p05-m01-report-framework`  
**Depends on:** P01-M01-T03 (RBAC)  
**⚡ Publishes I-7 — publish the interface early!**

### What to Do
Build the shared report infrastructure: filters, scope enforcement, generation metadata. All 5 reports (RPT-01 through RPT-05) plug into this framework.

### How to Implement

#### Report API Handler Pattern
```typescript
// lib/report/report-handler.ts

export interface ReportRequest {
  from?: string;       // date range start
  to?: string;         // date range end
  branchId?: string;
  agentId?: string;
  accountId?: string;
  planId?: string;
  status?: string;
  format: 'json' | 'csv';
  page?: number;
  pageSize?: number;
}

export interface ReportResult<T> {
  rows: T[];
  subtotals?: Record<string, string>;
  grandTotal?: Record<string, string>;
  filters: ReportRequest;
  generatedAt: string;        // ISO timestamp
  requestedBy: string;        // username
  totalRows: number;
  page: number;
  pageSize: number;
}
```

#### Scope Enforcement (CRITICAL)
```typescript
// Branch scope MUST be applied in the SQL WHERE clause
// Never fetch all rows and filter in JavaScript!

export function buildScopeClause(
  scope: BranchScope, 
  paramIndex: number
): { clause: string; params: unknown[] } {
  if (scope.branchId === null) {
    return { clause: '', params: [] };  // bank-wide, no restriction
  }
  return {
    clause: ` AND branch_id = $${paramIndex}`,
    params: [scope.branchId],
  };
}
```

#### Report Route Pattern
All reports go through `GET /api/reports/{report}`:
```typescript
// app/api/reports/[report]/route.ts

export async function GET(request: Request, { params }) {
  const user = await requireUser(request);
  requireRole(user, 'BRANCH_MANAGER', 'CENTRAL_OPS', 'AUDITOR', 'ADMIN');
  
  const scope = branchScope(user);
  const reportName = params.report;
  const filters = parseReportFilters(request.url);
  
  // Validate sort columns against allow-list
  const sortColumn = allowListed(filters.sort, ALLOWED_SORT_COLUMNS, 'posted_at');
  
  // Delegate to the specific report service
  const result = await getReport(reportName, filters, scope, user);
  
  // Audit the access (REP-COM-06)
  await auditReportAccess(user, reportName, filters);
  
  // Return JSON or CSV based on format
  if (filters.format === 'csv') {
    return streamCsv(result);
  }
  return Response.json({ data: result });
}
```

#### Report Display Requirements (REP-COM-01)
Every report must show:
- **Title** of the report
- **Filter values** that were applied
- **Generation timestamp**
- **Requesting user** name
- Detail rows + **subtotals** + **grand total** (REP-COM-03)

#### Frontend — Report Shell
```
components/report/
├── report-shell.tsx          # Wrapper with title, filters, metadata
├── report-filters.tsx        # Date range, branch, agent filters
├── report-table.tsx          # Data table with subtotals
├── report-totals.tsx         # Grand total row
├── report-export-button.tsx  # CSV download button
└── report-metadata.tsx       # Generated at, requested by
```

### Handoff — Publish I-7 Early!
Create `.agent/handoffs/i7-report-framework.md` with:
- The `ReportRequest` and `ReportResult` interfaces
- How to create a new report view
- How to add a report route
- How to use `buildScopeClause()`

---

## Task 2: CSV Export Utility (`P05-M01-T02`)
**Branch:** `feat/p05-m01-csv-export`  
**Depends on:** P05-M01-T01

### What to Do
Build a CSV export that uses the **same query** and produces **identical totals** as the JSON version (REP-COM-04).

### How to Implement
```typescript
// lib/report/csv-export.ts

export function streamCsv(result: ReportResult<unknown>): Response {
  const headers = new Headers({
    'Content-Type': 'text/csv; charset=utf-8',
    'Content-Disposition': `attachment; filename="${result.reportName}_${result.generatedAt}.csv"`,
  });
  
  // Stream the CSV — don't buffer the entire file in memory (REP-COM-05)
  const stream = new ReadableStream({
    start(controller) {
      // Header row
      controller.enqueue(csvRow(Object.keys(result.rows[0])));
      // Data rows
      for (const row of result.rows) {
        controller.enqueue(csvRow(Object.values(row)));
      }
      // Subtotals and grand total
      if (result.grandTotal) {
        controller.enqueue(csvRow(['', '', 'GRAND TOTAL', ...Object.values(result.grandTotal)]));
      }
      controller.close();
    },
  });
  
  return new Response(stream, { headers });
}
```

**Key rules:**
- Same query → same totals (REP-COM-04)
- Streamed, not buffered (REP-COM-05)
- Proper escaping for CSV fields containing commas/quotes

---

## Task 3: Report Access Auditing (`P05-M01-T03`)
**Branch:** `feat/p05-m01-report-audit`  
**Depends on:** P05-M01-T01

### What to Do
Every report access must be logged in the audit trail (REP-COM-06).

### How to Implement
```typescript
export async function auditReportAccess(
  user: AuthenticatedUser,
  reportName: string,
  filters: ReportRequest
): Promise<void> {
  await writeAuditEvent({
    userId: user.userId,
    actorType: 'USER',
    entityType: 'report',
    entityId: null,
    action: 'REPORT_ACCESSED',
    newValues: {
      report_name: reportName,
      filters: filters,
      format: filters.format,
    },
    ipAddress: user.ipAddress,
  });
}
```

---

## Task 4: Audit Search API & Page (`P05-M01-T04`)
**Branch:** `feat/p05-m01-audit-search`  
**Depends on:** P01-M01-T05

### What to Do
Build the audit search page — AUDITOR and ADMIN can search the audit trail.

### API: `GET /api/audit`
**Roles:** AUDITOR, ADMIN  
**Query params:** `actorId`, `entityType`, `entityId`, `action`, `from`, `to`

```sql
SELECT log_id, user_id, actor_type, entity_type, entity_id, 
       action, old_values, new_values, ip_address, logged_at
FROM audit_log
WHERE ($1::uuid IS NULL OR user_id = $1)
  AND ($2::varchar IS NULL OR entity_type = $2)
  AND ($3::uuid IS NULL OR entity_id = $3)
  AND ($4::varchar IS NULL OR action = $4)
  AND ($5::timestamptz IS NULL OR logged_at >= $5)
  AND ($6::timestamptz IS NULL OR logged_at <= $6)
ORDER BY logged_at DESC
LIMIT $7 OFFSET $8
```

Uses indexes: `(user_id, logged_at DESC)` and `(entity_type, entity_id)`.

### Frontend: `/admin/audit` Page
- Date range picker
- Actor filter (dropdown of users)
- Entity type filter
- Action filter
- Searchable, paginated results table
- Expandable rows showing old/new values (jsonb rendered nicely)

---

## Acceptance Criteria (All 4 tasks)
- [ ] Report framework handles filters, scope, and metadata (REP-COM-01, REP-COM-03)
- [ ] Branch scope enforced in SQL WHERE (REP-COM-02)
- [ ] CSV uses same query, produces identical totals (REP-COM-04)
- [ ] CSV is streamed, not buffered (REP-COM-05)
- [ ] Every report access is audited (REP-COM-06)
- [ ] Audit search works by actor, entity, action, and date range
- [ ] I-7 handoff published for other report owners
