# 0002. Plan eligibility function

**Date**: 2026-09-24
**Status**: Accepted

## Summary

This decides how `fn_check_plan_eligibility` works: a database function that checks whether a primary applicant (by birth date and requested holder count) qualifies for a savings plan, reading the age and holder rules from `savings_plan` (added in migration `0140`) instead of branching on the plan's name. It returns a simple yes or no, using today's date, and treats any bad or missing input as not eligible rather than raising an error.

## Context

`savings_plan` now stores each plan's eligibility rules as data (`min_age_years`, `max_age_years`, `min_holders`, `max_holders`, `requires_all_adult`), the result of task P01-M03-T01 and gap G-13. That data is only useful once something reads it. FR-ACC-02 requires that Children, Teen, Adult, Senior and Joint eligibility be enforced from date of birth and holder count, and the task tracker's stated signature is `fn_check_plan_eligibility(plan_id, date_of_birth, holder_count)`.

That signature carries one birth date, not one per holder. `requires_all_adult` exists to say every holder of a plan must be an adult, which matters for Joint accounts with two to four holders. A function that only ever sees a single birth date cannot verify the ages of holders two through four. The task tracker's own acceptance examples (a child aged 15 rejected for Children, an adult aged 30 accepted for Adult, a single holder rejected for Joint) all exercise a single applicant's age and a holder count, never a second holder's age, so the signature and the acceptance criteria agree with each other, just not with the full meaning of `requires_all_adult`. The boundary was confirmed directly with the engineer: this function checks the primary applicant only; the full "every holder is an adult" rule for Joint's additional holders is Phase 2's job, enforced by `trg_validate_joint_mandate` (`P02-M03-T03`, already scoped in the task tracker as owning the "2 to 4 adult holder rule").

Without this function, any caller (the account-opening routine in Phase 2, or a future admin tool) would have to re-implement the same age and holder comparisons inline, risking the exact hardcoded-branch problem G-13 already fixed at the schema level.

## Requirements

**User stories**:
- As the account-opening flow (a later Phase 2 task), I want a single function to call with an applicant's birth date, requested plan, and holder count, so I don't re-implement eligibility comparisons at every call site.
- As a database reviewer, I want eligibility computed from `savings_plan`'s own columns, so a new or renamed plan needs no code change.

**Acceptance criteria**:
- **AC-1**: A child aged 15 is rejected for the Children plan (`max_age_years = 12`).
- **AC-2**: An adult aged 30 is accepted for the Adult plan (`min_age_years = 18`, `max_age_years = 59`).
- **AC-3**: A single holder (`holder_count = 1`) is rejected for the Joint plan (`min_holders = 2`).
- **AC-4**: A plan whose age band has no upper bound (Senior, `max_age_years IS NULL`) accepts any age at or above `min_age_years`.
- **AC-5**: A plan whose age band has no lower bound (Children, `min_age_years IS NULL`) accepts any age at or below `max_age_years`.
- **AC-6**: A holder count within `[min_holders, max_holders]` inclusive is accepted; outside that range is rejected.
- **AC-7**: A nonexistent `plan_id` returns false, never an error.
- **AC-8**: An `INACTIVE` plan returns false regardless of age or holder count.
- **AC-9**: A `NULL date_of_birth` or a `NULL`/zero/negative `holder_count` returns false, never an error.
- **AC-10**: Age is computed as whole completed years against `CURRENT_DATE` (someone whose birthday is tomorrow is still last year's age today).

## Options considered

### Option 1: PL/pgSQL function, boolean return, reads `savings_plan` directly

A single `STABLE` PL/pgSQL function that selects the plan row by `plan_id`, and returns `true` only if the plan is `ACTIVE`, the computed age falls within its age band, and `holder_count` falls within its holder band. Any missing row or bad input flows through the same comparisons and naturally returns `false`.

**Pros**:
- One clear predicate other routines call directly in a `WHERE` or `IF` clause.
- No new table, no new dependency; reads the columns G-13 already added.
- Uniform handling of "not eligible" and "bad input" keeps the function's contract simple: one output type, no exception path for callers to catch.

**Cons**:
- Cannot report a specific reason ("too old" vs "too many holders"), only yes or no; a future admin UI wanting a specific message would need to re-derive the reason itself or this function extended later.

### Option 2: Return a reason code/text instead of boolean

Same comparisons, but returns an enum or text value (`ELIGIBLE`, `AGE_OUT_OF_RANGE`, `HOLDER_COUNT_OUT_OF_RANGE`, `PLAN_INACTIVE`, `PLAN_NOT_FOUND`) so a caller can show a specific message.

**Pros**:
- More useful directly for a user facing error message.

**Cons**:
- None of this task's stated acceptance criteria test specific reasons, only accept or reject; building this now is scope the task never asked for, and a caller that only wants a yes/no (the common case, e.g. account opening) has to compare the result against `'ELIGIBLE'` instead of using the value directly as a boolean.

### Option 3: `RAISE EXCEPTION` on ineligibility instead of returning a value

The function aborts the calling transaction with a specific error when the applicant does not qualify.

**Pros**:
- Forces the caller to handle ineligibility, impossible to silently ignore.

**Cons**:
- Ineligibility is an expected, common outcome (most eligibility checks in a UI flow are "not yet," not a system failure), so every caller would need exception handling for a routine "no" answer; mixes control flow with error handling in a way the rest of this project's functions (`fn_check_plan_minimum`, a later T02 sibling) are not expected to.

## Decision

**Chosen option**: Option 1: PL/pgSQL function, boolean return, reads `savings_plan` directly

## Rationale

Option 1 matches the task tracker's own naming (`fn_check_*` implies a predicate, not an action that can abort a transaction) and needs no new return type or enum the rest of the codebase does not already have a pattern for. Option 2's specific-reason reporting is real scope, but none of this task's acceptance criteria ask for it, and AGENTS.md's stance against inventing unapproved scope applies here the same way it did to G-13's column shape: add what the task asks for, not what might be convenient later. Option 3 was rejected because ineligibility is the expected outcome of a healthy system working correctly, not a failure; exceptions belong to genuinely exceptional conditions (a missing table, a broken connection), and forcing every caller into exception handling for "the applicant is 15 and this is the Children plan (max age 12)" adds friction with no benefit over a value the caller can check in an `IF`.

## Feature design

**Data model sketch**:
No new tables or columns. Reads existing `savings_plan` columns from migration `0140`: `status`, `min_age_years`, `max_age_years`, `min_holders`, `max_holders`. Does not read or need `requires_all_adult` (out of scope, see Context).

**State transitions**: none, a pure read/compute function.

**API surface**:
| Function | Inputs | Output | Auth | Key errors |
|---|---|---|---|---|
| `fn_check_plan_eligibility` | `plan_id uuid`, `date_of_birth date`, `holder_count int` | `boolean` | none (internal DB routine, not directly exposed; a future API endpoint calling it inherits that endpoint's own auth) | none raised; every invalid case returns `false` |

**Value sourcing**:
| Action | Value produced / displayed | Source |
|---|---|---|
| Eligibility check | The plan's `status`, `min_age_years`, `max_age_years`, `min_holders`, `max_holders` | `savings_plan` row for the given `plan_id` |
| Eligibility check | The applicant's age in whole years | Computed from `date_of_birth` and `CURRENT_DATE` inside the function, per AC-10 |
| Eligibility check | "Today" for the age computation | `CURRENT_DATE` at call time (confirmed with the engineer; no reference-date parameter) |

**Key invariants**:
- The function never raises for bad or missing input; every rejection path (missing plan, inactive plan, null birth date, non-positive holder count, out-of-range age or holder count) returns `false`.
- Age comparison and holder-count comparison are both inclusive at the bounds (`>=` and `<=`), and a `NULL` bound on either side means no limit in that direction.
- `STABLE` volatility: same result for the same arguments within one statement, matches that it only reads the database and depends on `CURRENT_DATE`, never writes.

**Security model**: Not directly exposed to any role; it is an internal predicate. `EXECUTE` is not revoked from `PUBLIC` (Postgres's default), consistent with `fn_check_plan_minimum` and other reference-table predicates in this project having no explicit grants file entry. The API surface that will call this (T03, and later Phase 2's account opening) owns its own authorization; this function does not need to know who is asking.

**Configuration required**: none.

**Critical test scenarios**:
- Happy path: adult aged 30, `holder_count = 1`, Adult plan returns `true`, verifies **AC-2**.
- Failure case: child aged 15 against the Children plan returns `false`, verifies **AC-1**. Single holder against Joint returns `false`, verifies **AC-3**.
- Boundary case: age exactly at `min_age_years` or `max_age_years`, holder count exactly at `min_holders` or `max_holders`, both accepted, verifies **AC-4**, **AC-5**, **AC-6**.
- Data integrity: nonexistent `plan_id`, `INACTIVE` plan, `NULL` birth date, and `NULL`/zero/negative holder count all return `false` without raising, verifies **AC-7**, **AC-8**, **AC-9**.

## Build plan

1. Write `database/routines/fn_check_plan_eligibility.sql`: `CREATE OR REPLACE FUNCTION`, `STABLE`, PL/pgSQL, implementing the comparisons in Feature design. Satisfies **AC-1** through **AC-10**.
2. Write `tests/db/plan-eligibility-function.test.mjs` covering every acceptance criterion: the task tracker's three named examples, both inclusive boundaries, and all four "return false, never raise" cases. Satisfies **AC-1** through **AC-9** (test proof).
3. Run `npm run db:rebuild && npm run db:verify && npm test` and confirm all pass, including the existing 8 `savings_plan` constraint tests and the full suite with no regressions.
4. Update `docs/16_database-routines-views-indexes.md`: add `fn_check_plan_eligibility` with its signature, volatility, and purpose.
5. Update `docs/09_task-tracker.md`: set `P01-M03-T02` to `DONE`.
6. Update `.agent/current-state.md` with the completed task.

## Consequences

**Positive**:
- Account opening (Phase 2) and any admin tool can call one function instead of re-deriving eligibility comparisons, keeping the "data-driven, not hardcoded" property G-13 established actually load bearing.
- A boolean return keeps every caller's code simple: `IF fn_check_plan_eligibility(...) THEN`.

**Negative / tradeoffs**:
- Does not check `requires_all_adult` for holders beyond the primary applicant; a caller opening a Joint account must still separately verify every holder's age (Phase 2's `trg_validate_joint_mandate`). Documented here so nobody assumes this function's `true` result means a Joint application is fully validated.
- No specific rejection reason is returned; a caller wanting to tell the applicant *why* they were rejected must re-derive it (likely by reading the same `savings_plan` row itself), a real but currently out-of-scope gap (see Option 2).

**Neutral**:
- Function lives in `database/routines/`, applied every `db:rebuild` via `CREATE OR REPLACE`, not tracked in `schema_migration` the way table migrations are; re-running it is always safe and has no ordering dependency on other routines.

## Follow-up

- [ ] When Phase 2's `trg_validate_joint_mandate` (`P02-M03-T03`) is built, confirm it independently enforces `requires_all_adult` across every holder, since this function does not.
- [ ] If a future task needs a specific rejection reason (not just accept/reject), revisit Option 2 as a new spec rather than retrofitting this function's signature.
