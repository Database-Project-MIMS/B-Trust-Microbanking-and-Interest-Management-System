# 🟡 Phase 3 — Tasks 01–02: Transaction Attribution & Agent Daily Activity
**Task IDs:** `P03-M02-T01`, `P03-M02-T02` · **Branch:** `feat/p03-m02-agent-attribution-activity`
**Migration:** `0320_p03_m02_transaction_attribution.sql` · **Status:** TODO
**Depends on:** `P02-M04-T01` (`transaction` schema, M4), **G-07** approved
**Story Points:** ~3 + ~3 = ~6 · **Layer:** Database + Backend

> ⚡ **UI COMPLETE** — Agent activity views are pre-built in `app/dashboard/**`. Your job
> is to implement the **database migration and API** only. Do not rebuild any UI component.

---

## What This Task Is

Two parts: add `agent_id`/`branch_id` attribution columns to M4's `transaction` table
(this is **G-07** from the gap analysis — required because RPT-01 is agent-wise and the
ERD as given has no way to attribute a transaction to an agent or branch), then build
the agent daily-activity API and page on top of it. This is a **shared-file change** —
`transaction` is owned by M4. Follow AGENTS.md §13: write a handoff before touching it.

---

## T01 — Transaction Attribution Columns (G-07)

**Column additions to `transaction`** (M4's table — you are adding columns, not creating
the table):

| Table | Column | Reason |
|---|---|---|
| `transaction` | `agent_id uuid NULL REFERENCES agent(agent_id)` | RPT-01 is agent-wise (FR-DEP-02); `INTEREST_CREDIT` rows have no agent, hence nullable |
| `transaction` | `branch_id uuid NULL REFERENCES branch(branch_id)` | Branch attribution at posting time |

**Why nullable, and why not derived:** agent could in principle be derived via
`initiated_by_user_id → agent`, but that only works when the initiator actually is an
agent — `INTEREST_CREDIT` rows are posted by the central system with no agent, and a
branch manager or admin posting on an agent's behalf is not an agent either. Branch has
the same problem: deriving it from `agent.branch_id` breaks the moment an agent
transfers branch (FR-ORG-04 explicitly allows this), silently rewriting historical
report totals. Both columns are captured **at posting time** and never re-derived.

**Indexes required (SRS §6.7):**
```sql
CREATE INDEX idx_transaction_agent_posted ON transaction(agent_id, posted_at);
CREATE INDEX idx_transaction_branch_posted ON transaction(branch_id, posted_at);
```

### Step 1 — Write a Handoff First
Before touching `transaction`, write `.agent/handoffs/p03-m02-transaction-attribution.md`
explaining: which columns you're adding, why (G-07), and that M4's posting routines
(`sp_post_deposit`, `sp_post_withdrawal`) must start setting these two columns. Confirm
with M4 (or check their task status) before merging.

### Step 2 — Write the Migration
Create file: `database/migrations/0320_p03_m02_transaction_attribution.sql`

```sql
-- Migration 0320: Transaction agent/branch attribution (M2, G-07)
-- Adds agent_id and branch_id to transaction; required for RPT-01

BEGIN;

ALTER TABLE transaction
    ADD COLUMN agent_id  uuid REFERENCES agent(agent_id),
    ADD COLUMN branch_id uuid REFERENCES branch(branch_id);

CREATE INDEX idx_transaction_agent_posted  ON transaction(agent_id, posted_at);
CREATE INDEX idx_transaction_branch_posted ON transaction(branch_id, posted_at);

INSERT INTO schema_migration(version, name)
VALUES (320, '0320_p03_m02_transaction_attribution');

COMMIT;
```

### Step 3 — Write SQL Tests
`tests/db/transaction-attribution.test.mjs`:
1. ✅ Columns exist and are nullable
2. ✅ Indexes exist (`\d transaction` or `pg_indexes` query)
3. ✅ A transaction row with `agent_id = NULL` (simulating `INTEREST_CREDIT`) inserts
   cleanly
4. ✅ A non-existent `agent_id` is rejected (`23503`)

---

## T02 — Agent Daily Activity API & Page

### `GET /api/agents/{id}/activity`
- **Purpose** Show an agent's transaction totals for a given day/range — the read-side
  precursor to RPT-01 (Phase 5)
- **Roles** `ADMIN`, `CENTRAL_OPS`, `BRANCH_MANAGER` (own branch's agents only), the
  agent themself
- **Query** `from`, `to` (default: today)
- **SQL** `SELECT transaction_type, COUNT(*), SUM(amount) FROM transaction WHERE
  agent_id = $1 AND posted_at BETWEEN $2 AND $3 GROUP BY transaction_type` — parameterized,
  branch scope applied via the agent's `branch_id`
- **Success** `200 { data: { agentId, from, to, byType: [{ type, count, total }] } }`

### Step 1 — Backend
`services/agent-service.ts`: add `getAgentActivity(agentId, range, scope)`.

### Step 3 — Write Tests
- `tests/api/agent-activity.test.mjs`: totals match a manually-seeded set of
  transactions; date range filters correctly; `BRANCH_MANAGER` cannot query an agent
  outside their branch → 403

### Step 4 — Run & Verify
```bash
npm run db:rebuild
npm run db:verify
npm run typecheck && npm test
```

### Step 5 — Update Docs
- Update `docs/04_database-schema.md` — `transaction` column additions (G-07 resolved)
- Update `docs/05_api-and-pages.md` — add `GET /api/agents/{id}/activity`
- Update `docs/17_erd-gap-analysis.md` — mark G-07 implemented
- Update task statuses in `docs/09_task-tracker.md` → `DONE`

---

## Acceptance Criteria
- [ ] Handoff written and acknowledged before modifying `transaction`
- [ ] `agent_id`/`branch_id` columns added, nullable, FK-constrained
- [ ] Both reporting indexes exist
- [ ] Agent activity endpoint respects branch scope in SQL
- [ ] `npm run db:rebuild` succeeds from empty
- [ ] `npm run typecheck && npm test` pass
