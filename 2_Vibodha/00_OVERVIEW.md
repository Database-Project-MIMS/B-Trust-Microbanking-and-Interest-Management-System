# 📋 Member 2 (Vibodha) — Complete Work Overview

**Name:** Herath H.M.V.L · **Index:** 240225J
**Domain Slice:** Organisation & Customers
**Total Story Points:** ~58 · **Total Tasks:** 18 across 6 phases

Full slice description and copy-paste session prompt: `../docs/member-prompts/member-2.md`
Running session log (updated via `/remember save`): `../.agent/members/member-2.md`

---

## 🗺️ Work Order Summary

| # | File | Phase | Task IDs | What You Build | Points |
|---|---|---|---|---|---|
| 01 | [Branch Schema](01_P1-T01_branch-schema.md) | P1 | T01 | `branch` table + `branch_code UNIQUE` | ~3 |
| 02 | [Agent Schema](02_P1-T02_agent-schema.md) | P1 | T02 | `agent` as a subtype of `app_user`; one-active-branch rule | ~3 |
| 03 | [Branch & Agent API + Admin UI](03_P1-T03-T04_branch-agent-api-ui.md) | P1 | T03–T04 | `/api/branches`, `/api/agents`, admin pages, deactivate-not-delete | ~8 |
| 04 | [Customer Schema](04_P2-T01_customer-schema.md) | P2 | T01 | `customer` table, identity uniqueness, trigram search index | ~4 |
| 05 | [Customer Agent & Document Schema](05_P2-T02-T03_customer-agent-document-schema.md) | P2 | T02–T03 | `customer_agent` (one-active-assignment), `customer_document` | ~6 |
| 06 | [Customer Registration Service & UI](06_P2-T04-T05_customer-registration-service-ui.md) | P2 | T04–T05 | Registration transaction, form, search, profile pages | ~10 |
| 07 | [Agent Attribution & Daily Activity](07_P3_agent-attribution-daily-activity.md) | P3 | T01–T02 | `agent_id`/`branch_id` on `transaction`, agent activity API & page | ~6 |
| 08 | [Customer↔FD Linkage & Branch Scope](08_P4_customer-fd-linkage.md) | P4 | T01–T02 | FD linkage view, customer FD listing, branch-scoped FD access | ~5 |
| 09 | [RPT-01 Agent Transactions Report](09_P5_rpt01-report.md) | P5 | T01–T02 | Agent-wise transaction view, API, page, CSV | ~7 |
| 10 | [Final Testing, Seed Validation & Docs](10_P6_final-testing-docs.md) | P6 | T01–T03 | Seed validation, master-data integrity tests, doc pass | ~6 |

---

## 📊 Effort by Phase

```
Phase 1  ████████████████████████████  14 pts  (4 tasks — Branch + Agent + API/UI)
Phase 2  ████████████████████████████████████████  20 pts (5 tasks — Customer slice, HEAVIEST)
Phase 3  ████████████                   6 pts  (2 tasks — Agent attribution + activity)
Phase 4  ██████████                     5 pts  (2 tasks — FD linkage + branch scope)
Phase 5  ██████████████                 7 pts  (2 tasks — RPT-01)
Phase 6  ████████████                   6 pts  (3 tasks — Testing + docs)
                                       ─────
                                       58 pts total
```

---

## 🔗 Integration Points

### You Publish

*(none — Member 2 does not publish an integration point in the current plan; you
consume from M1 and M4)*

### You Consume

| ID | What | From | Phase |
|---|---|---|---|
| **I-1** | `requireRole()`, `branchScope()`, CSRF verify | M1 | P1 |
| **I-2** | `withTransaction()` and SQLSTATE → domain error mapping | M4 | P1 |
| **I-7** | Report framework: filters, scope, CSV, access audit | M1 | P5 |

Blocking gate: **OQ-05** (G-20 — is a customer login required?) must be resolved before
`P02-M02-T01` can start. Check `.agent/open-questions.md` before beginning Phase 2.

---

## 🗄️ Database Objects You Own

### Tables (5)
`branch`, `agent`, `customer`, `customer_agent`, `customer_document`

### Routines
- Customer registration transaction (customer + documents + assignment + audit, atomic)
- Duplicate-identity detection (`ux_customer_nic`)

### Indexes
- `branch.branch_code` — `UNIQUE`
- `agent.employee_no`, `agent.nic_passport_no`, `agent.email` — `UNIQUE`; `(branch_id, status)`
- `customer.nic_passport_no` — `UNIQUE`; trigram index on `full_name`; `(branch_id)`
- One-active-assignment partial unique index: `ON customer_agent(customer_id) WHERE is_active`
- `transaction(agent_id, posted_at)`, `transaction(branch_id, posted_at)` — reporting indexes (Phase 3, G-07)

### Report Views (1)
- `vw_rpt01_agent_transactions` — agent-wise transaction counts and values by type

---

## 📁 Files You Own

| Path | Shared? |
|---|---|
| `app/branches/**` | No |
| `app/agents/**` | No |
| `app/customers/**` | No |
| `app/reports/agent-transactions/**` | No |

---

## 🔥 Phase 2 Is Your Critical Phase

**Phase 2 is your heaviest phase (20 pts — 5 tasks).** You own the entire customer
onboarding pipeline, and it gates other members: M3's `account_holder` and M1's RLS
policies both depend on your `customer` table. Suggested approach:

1. ✅ Confirm **OQ-05 / G-20** is resolved before touching T01 — the identity shape
   (`customer_id` as independent surrogate PK vs. subtype of `user`) changes your
   migration
2. ✅ Do T01 (`customer` schema) first — resolves the identity gap, unblocks M3
3. ✅ Do T02 (`customer_agent`) and T03 (`customer_document`) — both pure DB, can be
   done back-to-back
4. ⚡ Do T04 (registration service) — the hardest task: customer + documents +
   assignment + audit in **one transaction**
5. ✅ Do T05 (registration form, search, profile pages) last

---

## 📝 Key Rules to Remember

1. **No ORM** — handwritten parameterized SQL only (`$1, $2, ...`)
2. **Deactivate, never delete** — `branch`, `agent` and `customer` all use `RESTRICT` on
   delete; every "remove" action is a status update (FR-ORG-05)
3. **One current agent per customer** — enforced by a partial unique index on
   `customer_agent(customer_id) WHERE is_active`, not by application logic (G-10)
4. **Customer registration is atomic** — customer row, documents, assignment and audit
   event insert in **one transaction**, or none of them do
5. **Identity is masked** for unauthorised roles (FR-CUS-04) — enforce in the service
   layer, not just by hiding a UI field
6. **Branch scope is a SQL predicate** — every list/search query applies `branchScope()`
   inside the `WHERE` clause, never as a post-fetch filter in JavaScript
7. **Migration numbers 0120–0139 (P1), 0220–0239 (P2), 0320–0339 (P3), 0420–0439 (P4),
   0520–0539 (P5), 0620–0639 (P6)** — never collide with others
8. **Never edit a merged migration** — write a new one
9. **Don't modify files owned by another member** — write a handoff instead
