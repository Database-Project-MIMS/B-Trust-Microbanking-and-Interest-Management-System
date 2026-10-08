# 🟡 Phase 3 — Tasks 01–02: Transaction Attribution & Agent Daily Activity
**Task IDs:** `P03-M02-T01`, `P03-M02-T02` · **Branch:** `feat/p03-m02-agent-attribution-activity`
**Migration:** `0320_p03_m02_transaction_attribution.sql` · **Status:** T01 REVIEW (verified locally); T02 TODO
**Depends on:** `P02-M04-T01` (`transaction` schema, M4), **G-07** approved
**Story Points:** ~3 + ~3 = ~6 · **Layer:** Database + Backend

**Scope (2026-10-08):** implement T01 only. Vibodha authorized its early start and
the prescribed G-07 design (ADR-0016). No general Phase 3 entry approval. T02 remains
a separate task; its existing UI must be assessed before integration.

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
CREATE INDEX ix_transaction_agent_date ON transaction(agent_id, transaction_date);
CREATE INDEX ix_transaction_branch_date ON transaction(branch_id, transaction_date);
```

### Implementation contract

- Handoff: `.agent/handoffs/p03-m02-transaction-attribution.md`, written before DDL.
  M4's existing transaction-schema handoff explicitly reserves these columns for M2.
- New migration 0320 adds named `fk_transaction_agent` / `fk_transaction_branch`
  with `ON DELETE RESTRICT`, plus the two reporting indexes above.
- Use the real `transaction_date` column. The migration runner owns its filename/checksum
  ledger entry; do not insert obsolete `version`/`name` fields into `schema_migration`.
- No backfill, posting trigger, new API/UI, or edits to merged migrations. Existing
  opening-deposit inserts remain valid and unattributed until M3 adopts this contract.
- NULL attribution means unknown/system/unattributed. Future M4 routines capture trusted
  authorized values in their transaction; FKs alone do not enforce attribution or scope.
- Regression suite: `tests/db/transaction-attribution.test.mjs` — nullable UUIDs,
  actual reporting indexes, valid/NULL/legacy inserts, both FK failures, referenced-agent
  and branch deletion, transfer-stable totals, owner/runtime immutability, rollback,
  and populated-ledger upgrade preservation. Runs only in the disposable harness.
- T01's DB-only acceptance makes a new service/route/page and a new API test inapplicable;
  existing customer/account API regressions must still pass.

**Verified:** 15 attribution tests and all 501 tests in 45 suites pass. Clean
24-migration rebuild/checksum verification, TypeScript, lint, and production build
pass. `/review` has no unresolved T01 findings; the user publishes and M4 reviews.

---

## T02 — Agent Daily Activity API & Page

### `GET /api/agents/{id}/activity`
- **Purpose** Show an agent's transaction totals for a given day/range — the read-side
  precursor to RPT-01 (Phase 5)
- **Roles** `ADMIN`, `CENTRAL_OPS`, `BRANCH_MANAGER` (own branch's agents only), the
  agent themself
- **Query** `from`, `to` (default: today)
- **SQL** `SELECT transaction_type, COUNT(*), SUM(amount) FROM transaction WHERE
  agent_id = $1 AND transaction_date BETWEEN $2 AND $3 GROUP BY transaction_type` — parameterized,
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
- [x] Handoff written before DDL; existing M4 handoff reserves these additions; final M4 review retained
- [x] `agent_id`/`branch_id` columns added, nullable, FK-constrained (0320)
- [x] Both reporting indexes exist using `transaction_date`
- [ ] Agent activity endpoint respects branch scope in SQL
- [x] `npm run db:rebuild` succeeds from empty (disposable harness, 24 migrations)
- [x] `npm run typecheck && npm test` pass (full verify:phase1, 501 tests)
