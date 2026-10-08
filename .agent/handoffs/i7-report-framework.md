# Handoff: I-7 Report Framework

**Author:** Phase 5, Member 1
**Status:** PUBLISHED

This document publishes the shared reporting framework that all 5 report views (RPT-01 through RPT-05) must use.

## Interfaces
All reports must return a `ReportResult<T>` and accept `ReportRequest` parameters.

```typescript
import { ReportRequest, ReportResult, buildScopeClause } from '@/lib/report/report-handler';
```

## How to Create a New Report Route

1. Define your report route in `app/api/reports/[report]/route.ts`.
2. Extract the filters using standard URL parsing.
3. Validate roles (`requireRole(user, 'BRANCH_MANAGER', 'CENTRAL_OPS', 'AUDITOR', 'ADMIN')`).
4. Execute your database query, ensuring you use `buildScopeClause(scope, paramIndex)` in your `WHERE` clause.
5. Create the `ReportResult<T>` object.
6. Check `filters.format === 'csv'`. If true, return `streamCsv(result)` (from `@/lib/report/csv-export`). Otherwise, return `Response.json({ data: result })`.
7. Call `auditReportAccess()` (once implemented) before returning the response.

## Scope Enforcement (CRITICAL)
You **must** enforce branch scope in the SQL query itself, not in javascript after fetching all rows.

Example:
```typescript
const scopeQuery = buildScopeClause(scope, 1);
const query = `SELECT * FROM some_view WHERE 1=1 ${scopeQuery.clause}`;
const result = await pool.query(query, scopeQuery.params);
```
