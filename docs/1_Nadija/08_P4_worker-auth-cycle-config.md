# 🟡 Phase 4 — Member 1 Tasks: Interest Run Auth & Cycle Config
**Task IDs:** `P04-M01-T01`, `P04-M01-T02`  
**Migration Block:** `0400–0419`  
**Story Points:** ~6 total · **Layer:** Backend + Tests + Database

---

## Overview

Phase 4 adds Fixed Deposits & Interest. Your two tasks protect the interest cycle: authenticate the worker that runs interest, authorize and audit the runs, and make cycle configuration data-driven.

---

## Task 1: Worker Authentication for Interest Runs (`P04-M01-T01`)
**Branch:** `feat/p04-m01-worker-auth`  
**Depends on:** P04-M05-T04 (M5's interest run procedure)

### What to Do
The interest cycle can be triggered by:
1. A human with `CENTRAL_OPS` or `ADMIN` role (through the UI)
2. An automated **worker** using `INTEREST_WORKER_TOKEN` (scheduled job)

You need to authenticate both paths and audit every run.

### How to Implement

#### Worker Token Authentication
```typescript
// lib/auth/worker-auth.ts

export async function authenticateInterestWorker(
  request: Request
): Promise<AuthenticatedWorker> {
  const token = request.headers.get('Authorization')?.replace('Bearer ', '');
  
  if (!token) throw new NotAuthenticatedError();
  
  // Compare against the env variable
  const expectedToken = process.env.INTEREST_WORKER_TOKEN;
  if (!expectedToken || token !== expectedToken) {
    throw new NotAuthenticatedError();
  }
  
  return {
    actorType: 'SYSTEM',
    actorId: null,  // no user_id for system actors
  };
}
```

#### Route Handler
```typescript
// app/api/interest-runs/route.ts (POST handler)

export async function POST(request: Request) {
  let actor: { userId: string | null; actorType: string };
  
  // Try user authentication first
  try {
    const user = await requireUser(request);
    requireRole(user, 'CENTRAL_OPS', 'ADMIN');
    actor = { userId: user.userId, actorType: 'USER' };
  } catch {
    // Fall back to worker token
    const worker = await authenticateInterestWorker(request);
    actor = { userId: null, actorType: 'SYSTEM' };
  }
  
  // Audit the run request
  await writeAuditEvent({
    userId: actor.userId,
    actorType: actor.actorType,
    entityType: 'interest_run',
    entityId: null,
    action: 'INTEREST_RUN_INITIATED',
    newValues: { cycle_date: body.cycleDate, dry_run: body.dryRun },
    ipAddress: getIpAddress(request),
  });
  
  // Call M5's service...
}
```

#### Audit Events for Interest Runs
| Event | When |
|---|---|
| `INTEREST_RUN_INITIATED` | When someone triggers a run |
| `INTEREST_RUN_COMPLETED` | After the run finishes (with totals) |
| `INTEREST_RUN_FAILED` | If the run encounters a critical error |
| `INTEREST_PAYOUT_EXCEPTION` | For each FD that fails within a run |

### Tests
| Test | What it verifies |
|---|---|
| CENTRAL_OPS triggers run → authorized | Role-based access |
| ADMIN triggers run → authorized | Role-based access |
| AGENT triggers run → `403` | Explicitly denied |
| Worker token → authorized | Worker auth |
| Invalid worker token → `401` | Security |
| No auth at all → `401` | Security |
| Run creates audit event with actor info | Audit trail |
| System actor has `user_id = NULL` | G-22 compliance |

---

## Task 2: Cycle Configuration via `system_parameter` (`P04-M01-T02`)
**Branch:** `feat/p04-m01-cycle-config`  
**Depends on:** P01-M01-T05

### What to Do
Make the interest cycle configurable through `system_parameter` instead of hardcoded values.

### How to Implement

#### Add System Parameters (Migration `0401_p04_m01_cycle_config.sql`)
```sql
INSERT INTO system_parameter (param_key, param_value, description, data_type)
VALUES 
  ('INTEREST_CYCLE_DAYS', '30', 'Days between interest calculations', 'NUMBER'),
  ('MIN_FD_PRINCIPAL', '10000.00', 'Minimum fixed deposit principal', 'NUMBER')
ON CONFLICT (param_key) DO NOTHING;
```

#### Service Helper
```typescript
// services/interest-config-service.ts

export async function getInterestCycleDays(): Promise<number> {
  return await getParameterAsNumber('INTEREST_CYCLE_DAYS');
}

export async function getMinFdPrincipal(): Promise<string> {
  return await getParameter('MIN_FD_PRINCIPAL');
}
```

#### Update Parameter Admin Page
Ensure the new parameters appear on the `/admin/parameters` page and are editable by ADMIN.

### Tests
| Test | What it verifies |
|---|---|
| Cycle days read from `system_parameter` | Data-driven config |
| Changing the parameter value changes the cycle behavior | Not hardcoded |
| Admin can update cycle config | Admin access |

---

## Acceptance Criteria
- [ ] Interest runs can be triggered by CENTRAL_OPS, ADMIN, or a worker token
- [ ] Worker token auth is separate from user session auth
- [ ] Every interest run is audited (initiated, completed, failed)
- [ ] System actors have `user_id = NULL` and `actor_type = 'SYSTEM'`
- [ ] Interest cycle days are configurable via `system_parameter`
- [ ] AGENT, BRANCH_MANAGER, CUSTOMER, AUDITOR cannot trigger interest runs
