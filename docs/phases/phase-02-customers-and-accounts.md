# Phase 02 — Customers, Savings Accounts & Joint Ownership

**Status:** IN_PROGRESS — entry approved 2026-10-05; 3 DONE, 2 READY, 11 TODO · **Tasks:** 16 · **Effort:** 47 points

Approval: [Phase 1 checkpoint](../../.agent/checkpoints/phase-01-checkpoint.md).
Account (`0240`) and immutable transaction (`0260`) schema work is already verified.
Member 2's `P02-M02-T01` customer schema is DONE on `feat/p02-m02-customer-schema`;
assignment/document tasks are READY. Holder, mandate, account-opening, registration
and full seed work remain pending in this PR's tree.

**2026-10-05:** Vibodha's retained Phase 2 approval/customer-schema authorization is
recorded in [checkpoint](../../.agent/checkpoints/phase-01-checkpoint.md). P02-M02-T01
is technically complete locally: migration 0220, 27 customer tests and 38 organization
regressions pass, with clean rebuild/typecheck/lint. Assignment/documents are READY;
registration/API/UI and this phase's exit remain incomplete. At that initial verification,
earlier closeout edits were absent. The 2026-10-06 PR #34 conflict resolution now restores
those committed repairs from `dev`; combined-tree verification is recorded separately
in the [resolution handoff](../../.agent/handoffs/p02-m02-t01-pr34-conflict-resolution.md).

## Goal

Customers can be registered and assigned to agents; individual and joint accounts can be
opened with eligibility and mandate rules enforced by the database.

## Entry criteria

- [x] Phase 1 exit criteria met and entry approved by Vibodha
- [x] **OQ-05 resolved** (G-20, ADR-0007) — customers use an independent primary key
      and may optionally link to an application login.
- [x] G-06 approved by ADR-0008 — `account.branch_id` is stored at opening
- [x] G-08 approved by ADR-0009 — joint accounts require 2–4 adult holders and a mandate

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
- [x] Posted `transaction` rows reject `UPDATE` and `DELETE`
- [ ] Seed loads 18 customers, 22 accounts including 3 joint

## Risks

| Risk | Mitigation |
|---|---|
| Optional-login link is accidentally treated as mandatory | Test registration without `app_user_id`; keep the FK nullable and unique (ADR-0007) |
| M3 and M4 both need `transaction` | M4 owns and delivers the table in this phase; M3 calls it |
| Age boundary bugs (12 vs 13, 59 vs 60) | Seed includes customers at every boundary; tests assert each |
