# 00 — Documentation Index

**Current local closeout — 2026-10-10:** P06-M02-T01/T02 are merged through
PR #88/#90. Vibodha authorized T03 and necessary cross-owner completion in
[ADR-0026](../.agent/decisions/ADR-0026-final-local-closeout.md).
Branch `feat/p06-m02-final-documentation` is based on dev `053f6f6` (PR #91/#92
included). Local commits are authorized; push, PR creation and merge remain user actions.
Live HTTPS checks remain pending at the user's explicit instruction.

Read [implemented schema](18_implemented-database-catalog.md),
[endpoint permissions](19_implemented-api-matrix.md) and
[local closeout and remaining scope](20_final-local-closeout.md) for the current
implementation. The original ERD and historical verification results below are reference
material. Savings daily-balance interest, staff transfers and automatic FD maturity return
are implemented. [Predeployment audit](21_predeployment-audit.md) records frontend checks,
current evidence and remaining deployment/closure-policy limits; this is not general Phase 6 acceptance.

Start here. This tells you what every document is for, which ones are authoritative, and
what to read first.

**Current gate (2026-10-05):** Phase 1 verified; Phase 2 entry approved by Vibodha
for the local working tree. [Approval and evidence](../.agent/checkpoints/phase-01-checkpoint.md).
M2 Phase 2 tasks are implemented and PR #41 is merged. On 2026-10-08 Vibodha
authorized a scoped early start for P03-M02-T01 and its G-07 schema;
[ADR-0016](../.agent/decisions/ADR-0016-transaction-attribution.md) records the exception.
M2 Phase 3 T01/T02 are merged through PR #49/#53. The user also authorized the
P04-M02-T01 read-side start against merged M5 0480;
[ADR-0018](../.agent/decisions/ADR-0018-customer-fd-listing.md) records its scope.
Customer FD view/API/profile panel is merged through PR #60 (dev e9291dc). Vibodha
authorized scoped P04-M02-T02 implementation in
[ADR-0019](../.agent/decisions/ADR-0019-customer-fd-branch-scope.md); broader FD paths
remain with their owners. M5 opening was partial at that checkpoint; ADR-0026 supplies the controlled runtime and UI. Phase 2/3 exit and
general Phase 3/4/5 entry remain pending. The user controls publication.

P04-M02-T02 is DONE through merged PR #62 (dev 48f4185): current stored-actor FD guard
(0421), 630 tests /60 suites and clean isolated rebuild/type/lint/build evidence.
[Handoff](../.agent/handoffs/p04-m02-fd-branch-scope.md).

Vibodha authorized the database-only P05-M02-T01 early start in
[ADR-0020](../.agent/decisions/ADR-0020-rpt01-view.md). Its timestamp/type/posting-branch
view is merged through PR #67. PR #69 restores M1's I-7 framework on dev 93a82f8.
The user explicitly approved T02 and shared framework repairs in
[ADR-0022](../.agent/decisions/ADR-0022-rpt01-api-ui.md). T02 now delivers the live
scoped API/page, execute-only aggregate readers (0521), exact reversal-aware totals,
paginated JSON, snapshot CSV and atomic access audits. General phase entry remains pending.

The user explicitly authorized M4 withdrawal correction and documentation in
[ADR-0021](../.agent/decisions/ADR-0021-withdrawal-contract-repair.md). New 0363 repairs
the merged audit/mandate/limit/retry contract without changing 0362. Both M2 T01 and
M4 T03 pass **663 tests /62 suites**, a clean **34-migration** rebuild/checksums,
typecheck/lint/build before integration, with no exclusions; both are merged in PR #67.
That historical full-suite result does not describe the current merged baseline.
Current T02 checks and remaining integration failures are recorded in its
[handoff](../.agent/handoffs/p05-m02-rpt01-api-ui.md).
[M2 handoff](../.agent/handoffs/p05-m02-rpt01-view.md) ·
[M4 handoff](../.agent/handoffs/p03-m04-withdrawal-contract-repair.md).

## If you are new, read in this order

1. **`../AGENTS.md`** — the development contract. Non-negotiable rules.
2. **This file.**
3. `03_architecture.md` — how the layers fit together.
4. `04_database-schema.md` — what the tables are.
5. `07_business-rules.md` — what must be true, and where it is enforced.
6. `05_api-and-pages.md` — endpoint contracts.
7. `08_workload-division.md` — who owns what.
8. `09_task-tracker.md` — find your `READY` tasks.
9. `docs/phases/phase-XX-*.md` — your current phase.
10. `docs/member-prompts/member-N.md` — your copy-paste Claude prompt.
11. `../.agent/current-state.md` — where the project stands right now.
12. `10_local-setup.md` — get it running.

## Authority

When documents disagree, this is the order:

| Rank | Source | Note |
|---|---|---|
| 1 | Project 4 assignment brief | Original requirements |
| 2 | Explicit lecturer requirements | Including answers to open questions |
| 3 | **Group 32 approved ERD** | Outranks the SRS |
| 4 | Group 32 SRS v1.1 | |
| 5 | `AGENTS.md` | Binding for how we build |
| 6 | The `docs/` below | Derived; must not contradict 1–5 |

**Authoritative within this repository:** `AGENTS.md` (process), `04_database-schema.md`
(schema), `07_business-rules.md` (rules), `05_api-and-pages.md` (contracts),
`09_task-tracker.md` (what to do next). Everything else is supporting.

If you find a contradiction, do not resolve it silently — record it in
`../.agent/open-questions.md` and raise it.

## The documents

| # | Document | Purpose | Owner |
|---|---|---|---|
| 00 | `00_documentation-index.md` | This map | M2 |
| 01 | `01_project-description.md` | Scope, actors, workflows, out of scope | M2 |
| 02 | `02_srs-summary.md` | Implementation-oriented FR/NFR/BR digest | M2 |
| 03 | `03_architecture.md` | Layers, trust boundaries, transactions, deployment | M4 |
| 04 | **`04_database-schema.md`** | Every table: keys, columns, constraints, invariants. Current ERD vs proposed | M3 |
| 05 | **`05_api-and-pages.md`** | Endpoint contracts + page map | M1 |
| 06 | `06_seed-data-spec.md` | Sample data targets and determinism | M5 |
| 07 | **`07_business-rules.md`** | Every rule and its enforcement point | M3 |
| 08 | `08_workload-division.md` | Slices, effort, contribution matrix, ownership | lead |
| 09 | **`09_task-tracker.md`** | All 97 tasks with IDs, dependencies, status | all |
| 10 | `10_local-setup.md` | Clone to running system | M4 |
| 11 | `11_ui-rules.md` | UI conventions; points to `ui-registry.md` | M1 |
| 12 | `12_testing-and-acceptance.md` | Acceptance-to-test matrix | M5 |
| 13 | `13_system-operation-guide.md` | How to demonstrate the system | M2 |
| 14 | `14_git-workflow.md` | Branches, PRs, migration conflicts | M4 |
| 15 | `15_security-and-rbac.md` | Roles, permissions, hashing, RLS, audit | M1 |
| 16 | `16_database-routines-views-indexes.md` | Routine/view/index inventory + lecture-concept map | M4 |
| 17 | **`17_erd-gap-analysis.md`** | 21 findings across brief, SRS and ERD | lead |

### Phase documents

`phases/phase-00-initialization.md` … `phase-06-integration-testing-deployment.md` — one
per phase: goals, tasks, entry and exit criteria.

### Member prompts

`member-prompts/member-1.md` … `member-5.md` — a copy-paste prompt for each member's
Claude Code session.

## Related files outside `docs/`

| File | Purpose |
|---|---|
| `../AGENTS.md` | Development contract |
| `../CLAUDE.md` | Thin pointer to `AGENTS.md` |
| `../memory.md` | Session-to-session state (`/remember`) |
| `../ui-registry.md` | UI component patterns (`/imprint`) |
| `../.agent/current-state.md` | Live project status |
| `../.agent/open-questions.md` | Unresolved decisions |
| `../.agent/ownership-map.md` | File and object ownership |
| `../.agent/decisions/` | Architecture decision records |
| `../.agent/handoffs/` | Between-member handoffs |
| `../database/README.md` | SQL execution order |

## Keeping this honest

Documentation is updated **in the same PR** as the change (AGENTS.md §14). A PR that
changes the schema without updating `04_database-schema.md` should not be approved.

## Generated and verification closeout documents

| File | Purpose |
|---|---|
| `18_implemented-database-catalog.md` | Current clean-rebuild physical objects, constraints, policies and grants |
| `19_implemented-api-matrix.md` | Independent complete handler/role/input contract used by security tests |
| `20_final-local-closeout.md` | Current delivery, scope and acceptance boundary |
| `21_predeployment-audit.md` | Changes, requirement decisions, browser evidence, final tests and remaining limits |
| `22_docker-setup.md` | Local Docker app/database stack, credential separation, persistence and verification |
