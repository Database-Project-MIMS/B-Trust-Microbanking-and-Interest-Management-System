# 📋 Member 3 (Nisith) — Complete Work Overview

**Name:** Jayasuriya D.G.N.C · **Index:** 240285P
**Domain Slice:** Accounts, Plans & Joint Ownership
**Total Story Points:** ~60 · **Total Tasks:** 19 across 6 phases

Full slice description and copy-paste session prompt: `../docs/member-prompts/member-3.md`
Running session log (updated via `/remember save`): `../.agent/members/member-3.md`

---

## 🗺️ Work Order Summary

| # | File | Phase | Task IDs | What You Build | Points |
|---|---|---|---|---|---|
| ~~01~~ | ~~[Savings Plan Schema](01_P1-T01_savings-plan-schema.md)~~ | ~~P1~~ | ~~T01~~ | ~~`savings_plan` + eligibility columns (G-13)~~ | ~~~3~~ |
| ~~02~~ | ~~[Plan Eligibility Function](02_P1-T02_plan-eligibility-function.md)~~ | ~~P1~~ | ~~T02~~ | ~~`fn_check_plan_eligibility` — data-driven, not hardcoded~~ | ~~~3~~ |
| 03 | [Plan API](03_P1-T03_plan-api-admin-page.md) | P1 | T03 | `GET/PATCH /api/plans` | ~3 |
| 04 | [Account, Holder & Mandate Schema](04_P2-T01-T03_account-holder-mandate-schema.md) | P2 | T01–T03 | `account` (G-06, G-18), `account_holder`, `joint_mandate` + `trg_validate_joint_mandate` (G-08) | ~10 |
| 05 | [sp_open_savings_account](05_P2-T04_sp-open-savings-account.md) | P2 | T04 | Atomic account opening: account + holders + mandate + optional deposit | ~6 |
| 06 | [Accounts API](06_P2-T05-T06_accounts-api-ui.md) | P2 | T05–T06 | `/api/accounts/**` | ~9 |
| 07 | [fn_check_plan_minimum](07_P3-T01_fn-check-plan-minimum.md) | P3 | T01 | Post-withdrawal minimum-balance rule — **publishes I-4** | ~3 |
| 08 | [Mandate Validation & Balance](08_P3-T02-T03_mandate-validation-balance-panel.md) | P3 | T02–T03 | Joint-mandate check callable from withdrawal path; balance/authority endpoint | ~5 |
| 09 | [FD Eligibility & Closure](09_P4_fd-eligibility-closure-panel.md) | P4 | T01–T03 | Account-side FD eligibility (**I-6**), closure rule (BR-18) | ~7 |
| 10 | [RPT-02 Account Summary Report](10_P5_rpt02-report.md) | P5 | T01–T02 | Account-wise summary view, API, CSV | ~7 |
| 11 | [Concurrency & Constraint Tests](11_P6_concurrency-constraint-tests.md) | P6 | T01–T02 | Parallel-withdrawal overspend tests (AC-06); full constraint suite | ~5 |

---

## 📊 Effort by Phase

```
Phase 1  ████████████████████            9 pts  (3 tasks — Plan schema + eligibility + API)
Phase 2  ██████████████████████████████████████████████  25 pts (6 tasks — Accounts, HEAVIEST)
Phase 3  ████████████████               8 pts  (3 tasks — Minimum-balance + mandate + UI)
Phase 4  ██████████████                 7 pts  (3 tasks — FD eligibility + closure)
Phase 5  ██████████████                 7 pts  (2 tasks — RPT-02)
Phase 6  ██████████                     5 pts  (2 tasks — Concurrency + constraints)
                                       ─────
                                       61 pts total
```

---

## 🔗 Integration Points

### You Publish

| ID | What | Phase | Who Waits |
|---|---|---|---|
| **I-3** | `account.status` / `current_balance` read contract | P2→P3 | M4 — posting routines lock and read your account row |
| **I-4** | `fn_check_plan_minimum` + mandate validation for withdrawal | P3 | M4 — calls both inside its withdrawal transaction |
| **I-6** | One-active-FD constraint against account status | P4 | M5 — FD opening reads your account status under lock |

### You Consume

| ID | What | From | Phase |
|---|---|---|---|
| **I-1** | `requireRole()`, `branchScope()`, CSRF verify | M1 | P1–P2 |
| **I-2** | `withTransaction()` and SQLSTATE → domain error mapping | M4 | P2 |
| **I-7** | Report framework: filters, scope, CSV, access audit | M1 | P5 |

You are a **producer** for three integration points — M4 and M5 cannot safely build
their pieces until you publish a handoff in `.agent/handoffs/` for each. Do this
*before* marking the publishing task `DONE`, not after.

Blocking gates: **G-06** (account `branch_id`) and **G-08** (joint mandate) must be
approved before Phase 2 starts (see `docs/phases/phase-02-customers-and-accounts.md`
entry criteria).

---

## 🗄️ Database Objects You Own

### Tables (4)
`savings_plan` (with eligibility columns), `account`, `account_holder`, `joint_mandate`

### Routines
- `sp_open_savings_account` — account + holders + mandate + optional initial deposit,
  atomic
- `sp_close_account` — enforces BR-18 (zero balance, no active FD)
- `fn_check_plan_eligibility(plan_id, date_of_birth, holder_count)` — data-driven, never
  `IF plan_name = 'Children'`
- `fn_check_plan_minimum(plan_id, resulting_balance)` — post-withdrawal minimum rule,
  publishes I-4
- `fn_next_account_number()` — account number generation
- `trg_validate_joint_mandate` — statement-level trigger with transition tables
  enforcing the 2–4 adult holder rule (G-08)

### Constraints & Indexes
- `account.current_balance NOT NULL DEFAULT 0 CHECK (>= 0)` (G-18)
- `account.account_number` — `UNIQUE`; indexes `(plan_id)`, `(status)`, `(branch_id)`
- `account_holder` — `UNIQUE(account_id, customer_id)`
- `joint_mandate.account_id` — `UNIQUE`; `mandate_type CHECK IN ('ANY_ONE','ALL_HOLDERS')`
- `savings_plan` — `CHECK (max_age_years IS NULL OR min_age_years IS NULL OR
  max_age_years >= min_age_years)`

### Report Views (1)
- `vw_rpt02_account_summary` — account-wise transaction summary, opening/closing balance

---

## 📁 Files You Own

| Path | Shared? |
|---|---|
| `app/plans/**` | No |
| `app/accounts/**` | No |
| `app/reports/account-summary/**` | No |

---

## 🔥 Phase 2 Is Your Critical Phase

**Phase 2 is your heaviest phase (25 pts — 6 tasks), and it gates M4, M5 and both of
your later reports.** Suggested approach:

1. ✅ Confirm **G-06** and **G-08** are approved before writing anything — check
   `.agent/open-questions.md`
2. ✅ Do T01 (`account` schema) first — needs M2's `branch` (T01 of their slice) and
   your own `savings_plan` from Phase 1
3. ✅ Do T02 (`account_holder`) — needs M2's `customer` table (Phase 2, gated on OQ-05)
4. ⚡ Do T03 (`joint_mandate` + `trg_validate_joint_mandate`) — the hardest schema
   task: a **statement-level trigger with transition tables**, not a row-level `CHECK`,
   because the 2–4 holder rule spans rows (L08 material)
5. ⚡ Do T04 (`sp_open_savings_account`) — needs M4's `transaction` table
   (`P02-M04-T01`) for the optional initial deposit; the whole opening is one atomic
   routine
6. ✅ Do T05–T06 (APIs + wizard/detail/holder pages) last

---

## 📝 Key Rules to Remember

1. **No ORM** — handwritten parameterized SQL only (`$1, $2, ...`)
2. **Eligibility is data-driven** — `fn_check_plan_eligibility` reads `min_age_years` /
   `max_age_years` / `min_holders` / `max_holders` from `savings_plan`; never
   `IF plan_name = 'Children'` hardcoded in a routine or in TypeScript — this
   distinction is explicitly worth marks
3. **Holder-count rules cannot be a row-level `CHECK`** — they span rows (need to count
   how many `account_holder` rows exist for an `account_id`), so they belong in a
   **statement-level trigger with transition tables** (G-08)
4. **Money is `NUMERIC(15,2)`** — string across the API, never a JavaScript float
5. **Balance never goes negative** — `CHECK (current_balance >= 0)` is the last line of
   defence behind row locking, not a substitute for it (G-18)
6. **Account opening is one atomic transaction** — account + holders + mandate +
   optional initial deposit + audit, all or nothing
7. **Closing requires zero balance and no active FD** (BR-18, FR-ACC-05) — enforced in
   the closure procedure, not just the UI
8. **Migration numbers 0140–0159 (P1), 0240–0259 (P2), 0340–0359 (P3), 0440–0459 (P4),
   0540–0559 (P5), 0640–0659 (P6)** — never collide with others
9. **Never edit a merged migration** — write a new one
10. **You are a producer for I-3, I-4 and I-6** — write the handoff before the
    consuming member's task can move to `READY`
