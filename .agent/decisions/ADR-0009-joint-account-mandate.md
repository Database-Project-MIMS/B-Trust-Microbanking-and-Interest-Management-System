# ADR-0009: Joint accounts require a stored operating mandate

**Date:** 2026-10-01 · **Status:** Accepted

## Decision

Joint accounts have two to four adult holders and exactly one effective operating
mandate. `account_holder` gains `holder_type` (`PRIMARY` or `JOINT`). A new
`joint_mandate` table stores one mandate per account with type `ANY_ONE` or
`ALL_HOLDERS`, required signatories and effective dates.

The database validates the cross-row holder count and adult requirement with the
Phase 2 mandate-validation trigger. The account-opening operation also validates the
complete holder and mandate set inside its transaction, so an invalid partial joint
account cannot commit.

For `ANY_ONE`, `required_signatories` is 1. For `ALL_HOLDERS`, it equals the number of
active holders. Individual accounts do not have a `joint_mandate` row.

## Why

The approved ERD can link holders to accounts but cannot express who may authorize a
joint withdrawal. The assignment requires a stored mandate and rejects joint accounts
outside the two-to-four-adult-holder boundary.

## What it rules out

- Treating a joint account as valid without a stored mandate
- Storing the mandate only in frontend or service code
- Enforcing a cross-row holder count with an impossible row-level `CHECK`
- Allowing child holders on a plan that requires every holder to be an adult

## Consequences

- `P02-M03-T02` adds `holder_type` to `account_holder`.
- `P02-M03-T03` creates `joint_mandate` and the cross-row validation trigger.
- `sp_open_savings_account` writes holders and the mandate atomically and must satisfy
  both the schema constraints and trigger.
- Phase 3 withdrawal authorization reads the stored mandate rather than inferring it.
