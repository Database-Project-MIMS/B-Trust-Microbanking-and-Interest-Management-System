# 📋 Member 5 (Selith) — Complete Work Overview

**Name:** Rubasingha S.T · **Index:** 240575P  
**Domain Slice:** Fixed Deposits, Interest & Product Reporting  
**Total Story Points:** 58 · **Total Tasks:** 14 across 6 phases

---

## 🗺️ Work Order Summary

| # | File | Phase | Task IDs | What You Build | Points |
|---|---|---|---|---|---|
| ~~01~~ | ~~[FD Product Schema](01_P1-T01_fd-plan-schema.md)~~ | ~~P1~~ | ~~T01~~ | ~~`fd_plan` table with effective-dating columns~~ | ~~~3~~ |
| ~~02~~ | ~~[FD Product API](02_P1-T02_fd-product-api-admin.md)~~ | ~~P1~~ | ~~T02~~ | ~~`GET/PATCH /api/fd-products` with rate history~~ | ~~~3~~ |
| ~~03~~ | ~~[Seed Framework](03_P1-T03_seed-framework.md)~~ | ~~P1~~ | ~~T03~~ | ~~Seed layout, fixed-UUID scheme, ordered load ⚡ **PUBLISHES I-8**~~ | ~~~2~~ |
| 04 | [Seed Data Sets 1–3](04_P2_seed-sets-1-3.md) | P2 | T01 | Branches, agents, customers, accounts, 2 joint accounts | ~6 |
| 05 | [Seed Data Set 4](05_P3_seed-set-4-transactions.md) | P3 | T01 | 100+ mixed transactions across dates, branches, agents, plans | ~6 |
| 06 | [FD Schema & Opening](06_P4_fd-schema-opening.md) | P4 | T01–T03 | `fixed_deposit` table, `sp_open_fixed_deposit`, `fn_calculate_fd_interest` | ~10 |
| 07 | [Interest Cycle](07_P4_interest-run-cycle.md) | P4 | T04–T05 | `interest_run`, `interest_payout`, `sp_run_interest_cycle` | ~8 |
| 08 | [RPT-03 & RPT-04 Reports](08_P5_reports-rpt03-rpt04.md) | P5 | T01–T04 | Active FDs view, interest distribution view, APIs, CSV, `EXPLAIN ANALYZE` | ~12 |
| 09 | [Final Testing & Ops](09_P6_testing-ops-deployment.md) | P6 | T01–T02 | Interest re-run idempotency tests, backup/restore evidence, demo script | ~8 |

---

## 📊 Effort by Phase

```
Phase 1  ████████████████               8 pts  (3 tasks — FD Products + Seed Framework)
Phase 2  ████████████                   6 pts  (1 task  — Seed Sets 1–3)
Phase 3  ████████████                   6 pts  (1 task  — Seed Set 4)
Phase 4  ████████████████████████████████████  18 pts (5 tasks — FD + Interest ⚡ HEAVIEST)
Phase 5  ████████████████████████       12 pts (4 tasks — Reports + EXPLAIN ANALYZE)
Phase 6  ████████████████               8 pts  (2 tasks — Testing + Deployment)
                                       ─────
                                       58 pts total
```

---

## 🔗 Integration Points

### You Publish

| ID | What | Phase | Who Waits |
|---|---|---|---|
| **I-8** | Seed framework: fixed-UUID scheme, ordered load, `seed-check.mjs` | P1 | **ALL 4 members** (they supply data, you integrate) |

### You Consume

| ID | What | From | Phase |
|---|---|---|---|
| **I-1** | `requireRole()`, `branchScope()`, `verifyCsrf()` | M1 | P1 |
| **I-5** | `INTEREST_CREDIT` posting through the ledger routine | M4 | P4 |
| **I-6** | Account-side FD eligibility read under lock | M3 | P4 |
| **I-7** | Report framework: filters, scope, CSV, access audit | M1 | P5 |

---

## 🗄️ Database Objects You Own

### Tables (4)
`fd_plan`, `fixed_deposit`, `interest_payout`, `interest_run`

### Stored Procedures (2)
`sp_open_fixed_deposit`, `sp_run_interest_cycle`

### Functions (1)
`fn_calculate_fd_interest`

### Indexes (4+)
- One-active-FD partial unique index: `ON fixed_deposit(account_id) WHERE status = 'ACTIVE'`
- FD-due index: `ON fixed_deposit(status, next_interest_date)`
- Cycle-idempotency: `UNIQUE(cycle_date)` on `interest_run`
- Payout-idempotency: `UNIQUE(fd_id, cycle_date)` on `interest_payout`

### Report Views (2)
- `vw_rpt03_active_fds` — Active FDs and next payout dates
- `vw_rpt04_interest_distribution` — Monthly interest distribution by account type

### Seed Framework
`database/seed/` — fixed UUIDs, deterministic dates, ordered load for all members

---

## 📁 Files You Own

| Path | Shared? |
|---|---|
| `app/fd-products/**` | No |
| `app/fixed-deposits/**` | No |
| `app/interest-runs/**` | No |
| `app/reports/active-fds/**` | No |
| `app/reports/interest-distribution/**` | No |
| `database/seed/**` | **Yes — members supply data, you integrate** |

---

## 🔥 Phase 4 Is Your Critical Phase

**Phase 4 is your heaviest phase (18 pts — 5 tasks).** You own the entire FD and interest pipeline. Suggested approach:

1. ✅ Do T01 (FD schema) first — pure DB, resolves G-01/G-23/G-11
2. ✅ Do T03 (interest function) next — testable in isolation
3. ✅ Do T02 (`sp_open_fixed_deposit`) — needs M3's I-6
4. ⚡ Do T04 (`sp_run_interest_cycle`) — needs M4's I-5, the hardest task
5. ✅ Do T05 (UI pages) last — wire up after all the DB work is solid

---

## ⚡ The Interest Formula

```
interest = round(principal × interest_rate_at_opening × 30 / 365, 2)
```

- Exact `NUMERIC` throughout — never JavaScript floats
- Rate from the **FD's snapshot column** (`interest_rate_at_opening`), never from `fd_plan`
- Rounding happens **once**, at the end, in PostgreSQL

**Worked example:** LKR 100,000 at 14% → `100000 × 0.1400 × 30 / 365` = **LKR 1,150.68**

---

## 📝 Key Rules to Remember

1. **No ORM** — handwritten parameterized SQL only (`$1, $2, ...`)
2. **Money is NUMERIC(15,2)** — string across API, never a JavaScript float
3. **Rate snapshot at opening** — `interest_rate_at_opening`, never re-read from `fd_plan`
4. **One transaction per FD** in the interest run — a single failure cannot roll back completed distributions
5. **Idempotency by constraint** — `UNIQUE(cycle_date)` and `UNIQUE(fd_id, cycle_date)`, not procedural checks
6. **Migration numbers 0180–0199 (P1), 0280–0299 (P2), etc.** — never collide with others
7. **Never edit a merged migration** — write a new one
8. **Don't modify files owned by another member** — write a handoff instead
