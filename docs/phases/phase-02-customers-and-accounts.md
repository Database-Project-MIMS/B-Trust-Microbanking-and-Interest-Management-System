# Phase 02 — Customers, Savings Accounts & Joint Ownership

**Status:** TODO · **Tasks:** 16 · **Effort:** 47 points · **Est.** ~1 week

## Goal

Customers can be registered and assigned to agents; individual and joint accounts can be
opened with eligibility and mandate rules enforced by the database.

## Entry criteria

- [ ] Phase 1 exit criteria met
- [ ] **OQ-05 resolved** (G-20 — customer identity and whether customer login is required).
      `P02-M02-T01` cannot start until this is decided, because it determines the primary
      key of `customer`.
- [ ] G-06 (account `branch_id`) and G-08 (joint mandate) approved

## Tasks by member

| Member | Focus |
|---|---|
| **M1** | RLS policies on `customer` and `account`; audit coverage; branch-scope enforcement on the new routes |
| **M2** | `customer`, `customer_agent`, `customer_document`; registration service (**one transaction**); registration, search and profile pages |
| **M3** | `account`, `account_holder`, `joint_mandate`; `sp_open_savings_account`; `trg_validate_joint_mandate`; accounts APIs; opening wizard and detail pages |
| **M4** | `transaction` table + immutability trigger — created now so account opening can post an initial deposit |
| **M5** | Seed sets 1–3: branches, agents, customers, accounts, 3 joint accounts |

## Key database work

- **Many-to-many** customer↔account through `account_holder` — this is what makes joint
  accounts possible (SRS §6.3) and a clean 2NF/3NF demonstration.
- **Statement-level trigger with transition tables** for the 2–4 adult holder rule — a rule
  that spans rows and therefore cannot be a row-level `CHECK`. Good L08 material.
- **Data-driven eligibility**: `fn_check_plan_eligibility` reads `min_age_years` /
  `max_age_years` from `savings_plan`, never `IF plan_name = 'Children'`.
- **Atomic opening**: account + holders + mandate + optional initial deposit + audit in one
  transaction.

## Exit criteria

- [ ] A customer can be registered with documents and an agent assignment in one transaction
- [ ] A duplicate NIC is rejected and leaves **no partial customer row**
- [ ] Exactly one active agent assignment per customer is enforced
- [ ] An individual account opens with plan eligibility checked from date of birth
- [ ] A joint account opens with 2–4 adult holders and a stored mandate
- [ ] 1-holder and 5-holder joint accounts are both rejected by the trigger
- [ ] An opening amount below the plan minimum is rejected
- [ ] RLS prevents cross-branch customer and account reads **when the app layer is bypassed**
- [ ] Posted `transaction` rows reject `UPDATE` and `DELETE`
- [ ] Seed loads 18 customers, 22 accounts including 3 joint

## Risks

| Risk | Mitigation |
|---|---|
| OQ-05 unresolved delays M2 and M3 | Resolve during Phase 1; M2/M3 can build documents and plans work meanwhile |
| M3 and M4 both need `transaction` | M4 owns and delivers the table in this phase; M3 calls it |
| Age boundary bugs (12 vs 13, 59 vs 60) | Seed includes customers at every boundary; tests assert each |
