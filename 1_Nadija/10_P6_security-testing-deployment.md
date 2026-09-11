# 🔴 Phase 6 — Member 1 Tasks: Security Testing & Deployment
**Task IDs:** `P06-M01-T01`, `P06-M01-T02`, `P06-M01-T03`, `P06-M01-T04`  
**Story Points:** ~9 total · **Layer:** Tests + Config

---

## Overview

Phase 6 is the final phase — verification and delivery. Your 4 tasks are all about proving that the security guarantees are real, not just claimed. This is where you demonstrate the database competence that earns the grade.

---

## Task 1: SQL Injection Test Suite (`P06-M01-T01`)
**Branch:** `feat/p06-m01-sql-injection-tests`  
**Depends on:** Phase 5 complete

### What to Do
Test **every** endpoint with real SQL injection payloads to prove that parameterized queries are actually protecting the system.

### How to Implement

Create `tests/security/sql-injection.test.mjs`:

```javascript
// Test payloads to try on EVERY endpoint
const SQL_INJECTION_PAYLOADS = [
  "'; DROP TABLE app_user; --",
  "' OR '1'='1",
  "' UNION SELECT password_hash FROM app_user --",
  "1; SELECT pg_sleep(10) --",
  "' AND 1=1 --",
  "admin'--",
  "1' ORDER BY 100 --",
  "' OR 1=1; COPY app_user TO '/tmp/pwned' --",
];

// Test each endpoint with each payload in EVERY parameter position
const ENDPOINTS = [
  { method: 'POST', path: '/api/auth/login', fields: ['username', 'password'] },
  { method: 'GET', path: '/api/customers', fields: ['search', 'branchId'] },
  { method: 'GET', path: '/api/accounts', fields: ['search', 'accountNumber'] },
  { method: 'POST', path: '/api/transactions/deposits', fields: ['accountId', 'amount', 'narration'] },
  { method: 'GET', path: '/api/reports/agent-transactions', fields: ['from', 'to', 'branchId'] },
  { method: 'GET', path: '/api/audit', fields: ['actorId', 'entityType', 'action'] },
  // ... ALL endpoints
];
```

**What to assert:**
- The request either returns a validation error (400) or succeeds safely
- No SQL error text leaks to the client
- No unintended data is returned
- The database state is unchanged (no dropped tables!)
- Response time is normal (no `pg_sleep` success)

---

## Task 2: Authorization Matrix Tests (`P06-M01-T02`)
**Branch:** `feat/p06-m01-auth-matrix-tests`  
**Depends on:** Phase 5 complete

### What to Do
Test **every role × every route** combination to ensure the permission matrix from `15_security-and-rbac.md` is actually enforced.

### How to Implement

Create `tests/security/authorization-matrix.test.mjs`:

```javascript
// The full matrix
const MATRIX = [
  // [endpoint, method, allowedRoles[], deniedRoles[]]
  ['/api/auth/login', 'POST', ['*'], []],  // public
  ['/api/admin/users', 'GET', ['ADMIN'], ['CENTRAL_OPS', 'BRANCH_MANAGER', 'AGENT', 'AUDITOR', 'CUSTOMER']],
  ['/api/admin/parameters', 'GET', ['ADMIN'], ['CENTRAL_OPS', 'BRANCH_MANAGER', 'AGENT', 'AUDITOR', 'CUSTOMER']],
  ['/api/branches', 'POST', ['ADMIN'], ['CENTRAL_OPS', 'BRANCH_MANAGER', 'AGENT', 'AUDITOR', 'CUSTOMER']],
  ['/api/agents', 'POST', ['ADMIN', 'BRANCH_MANAGER'], ['AGENT', 'AUDITOR', 'CUSTOMER']],
  ['/api/customers', 'POST', ['AGENT', 'BRANCH_MANAGER'], ['AUDITOR', 'CUSTOMER']],
  ['/api/transactions/deposits', 'POST', ['AGENT', 'BRANCH_MANAGER'], ['AUDITOR', 'CUSTOMER', 'CENTRAL_OPS']],
  ['/api/transactions/{id}/reverse', 'POST', ['BRANCH_MANAGER', 'ADMIN'], ['AGENT', 'CENTRAL_OPS', 'AUDITOR', 'CUSTOMER']],
  ['/api/interest-runs', 'POST', ['CENTRAL_OPS', 'ADMIN'], ['BRANCH_MANAGER', 'AGENT', 'AUDITOR', 'CUSTOMER']],
  ['/api/reports/agent-transactions', 'GET', ['BRANCH_MANAGER', 'CENTRAL_OPS', 'AUDITOR', 'ADMIN'], ['AGENT', 'CUSTOMER']],
  ['/api/audit', 'GET', ['AUDITOR', 'ADMIN'], ['CENTRAL_OPS', 'BRANCH_MANAGER', 'AGENT', 'CUSTOMER']],
  // ... ALL routes
];

// For each denied combination:
// 1. Authenticate as that role
// 2. Make the request
// 3. Assert 403
// 4. Assert no side effects (no data changed)
```

---

## Task 3: RLS Verification (`P06-M01-T03`)
**Branch:** `feat/p06-m01-rls-verification`  
**Depends on:** P02-M01-T01 (RLS policies)

### What to Do
Prove that RLS policies hold **when the application layer is bypassed**. Connect directly as `mims_app` and attempt cross-branch reads.

### How to Implement

Create `tests/security/rls-bypass.test.mjs`:

```javascript
// Connect directly to the database as mims_app (NOT through the API)
import { Pool } from 'pg';

const pool = new Pool({
  user: 'mims_app',  // The application role, not mims_owner
  // ...
});

// Test 1: Set branch context to Branch A, try to read Branch B customers
await pool.query("SET LOCAL app.current_branch_id = $1", [branchAId]);
const result = await pool.query(
  "SELECT * FROM customer WHERE branch_id = $1", 
  [branchBId]
);
assert.strictEqual(result.rows.length, 0, 'RLS should block cross-branch reads');

// Test 2: Set customer context, try to read other customer's accounts
await pool.query("SET LOCAL app.current_user_id = $1", [customerAId]);
await pool.query("SET LOCAL app.current_user_role = 'CUSTOMER'");
const accounts = await pool.query(
  "SELECT * FROM account WHERE account_id = $1",
  [customerBAccountId]
);
assert.strictEqual(accounts.rows.length, 0, 'RLS should block cross-customer reads');

// Test 3: Bank-wide role sees everything
await pool.query("SET LOCAL app.current_branch_id = NULL");
const all = await pool.query("SELECT COUNT(*) FROM customer");
assert(all.rows[0].count > 0, 'Bank-wide should see all');
```

---

## Task 4: Deployment Security (`P06-M01-T04`)
**Branch:** `feat/p06-m01-deployment`

### What to Do
Configure deployment secrets, HTTPS, and security headers.

### How to Implement

#### `.env.example` — Document all required secrets
```env
DATABASE_URL=postgresql://mims_app:***@localhost:5432/mims
SESSION_SECRET=generate-a-random-32-byte-secret
INTEREST_WORKER_TOKEN=generate-another-random-secret
NODE_ENV=production
```

#### Security Headers (in `next.config.ts`)
```typescript
const securityHeaders = [
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'X-XSS-Protection', value: '1; mode=block' },
  { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' },
];
```

#### Checklist
- [ ] No secret in any `NEXT_PUBLIC_*` variable
- [ ] No secret committed to git
- [ ] HTTPS configured
- [ ] Error responses leak no SQL, stack traces, or credentials
- [ ] Database connection string uses `mims_app`, not `mims_owner`
- [ ] `mims_app` cannot `DROP`, cannot bypass audit triggers

---

## Acceptance Criteria (All 4 tasks)
- [ ] SQL injection payloads are neutralized by parameter binding on every endpoint
- [ ] Every role × route combination matches the permission matrix
- [ ] RLS holds when connecting directly as `mims_app`, bypassing the application
- [ ] No secret in client-reachable code or `NEXT_PUBLIC_*`
- [ ] Error responses never leak SQL text, stack traces, or credentials
- [ ] HTTPS and security headers configured
