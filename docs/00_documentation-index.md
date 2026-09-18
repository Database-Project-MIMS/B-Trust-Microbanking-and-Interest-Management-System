# 00 — Documentation Index

Start here. This tells you what every document is for, which ones are authoritative, and
what to read first.

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
| 09 | **`09_task-tracker.md`** | All 96 tasks with IDs, dependencies, status | all |
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
