# Memory — MIMS customer relations

> /remember save: current, non-sensitive continuation state.

**Updated:** 2026-10-05
**Task/branch:** P02-M02-T02/T03 on feat/p02-m02-customer-agent-document.

## What was completed

0221 customer_agent: restrictive FKs/date check, current-assignment partial unique
index, preserved inactive history and lifecycle timestamps. 0222 customer_document:
metadata paths, restrictive customer/verifier FKs, paired verification check/timestamps.
services/customer-document-service.ts verifies active in-scope AGENT/BRANCH_MANAGER
documents with row locks and same-transaction minimal audit. Agents need their current
assignment. Same verifier retry retains timestamp; another verifier gets a conflict.
Updated schemas/rules/inventory/tracker/task card/overview and published a local handoff.

## Verified state

npm run verify:customer-agent-document: 134 tests pass, zero fail/skip; all 14 migrations
rebuild cleanly/reapply/verify, typecheck/lint pass. Test cluster removed. Development
DB received only new 0221/0222 additively and verifies; existing data was not reset.
Service/concurrency fixtures that commit can run only in the disposable named DB.

## What comes next

P02-M02-T04 registration service is READY with T02/T03 and I-1/I-2 dependencies met.
Next documented branch: feat/p02-m02-customer-registration. T05 API integration remains
TODO; its specific task card describes prebuilt screens, despite older tracker FE label.
M1 scoped runtime grants/RLS and generic audit integration are needed before exposing
customer routes. Do not grant broad access or use owner credentials at runtime.
The partial index only supplies at most one assignment; registration/reassignment must
guarantee existence. Do not invoke verifyDocument's separate transaction on uncommitted
registration rows. Full contract/review: .agent/handoffs/p02-m02-t02-t03-customer-agent-document.md.

## Persistent constraints

User committed T01 and switched to the current branch before this task. Current changes
remain uncommitted: user prohibits assistant commits, merges and PR creation.
No push performed. User Phase 2 approval persists. Earlier uncommitted Phase 1 closeout
repairs are absent; do not claim those earlier tests certify this checkout. Historical
checkpoint records that condition. Legacy migration-runner test resets mims_dev and edits
an existing migration; exclude it from development-DB verification. No other owner's
implementation or old migration changed. No UI added or imprint required.
