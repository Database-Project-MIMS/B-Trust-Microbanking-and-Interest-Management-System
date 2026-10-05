# Member 2 — context

**Updated:** 2026-10-05
Slice: [member prompt](../../docs/member-prompts/member-2.md).

## Current task

P02-M02-T01 customer schema: implementation/tests/docs complete locally.
Branch: `feat/p02-m02-customer-schema`. Migration 0220 applies and all 12 local
migrations verify. No commit, merge or PR is authorized/performed.

## Completed contract

Independent customer_id, optional unique app_user_id (ADR-0007), required unique
customer_number/NIC/email, restrictive branch/login FKs, strict past birth date,
ACTIVE/INACTIVE status, timestamps and B-tree/GIN search indexes. 27 customer tests
and 38 organization regressions pass, plus isolated clean rebuild, typecheck and lint.
M1/M3 handoff: [customer schema](../handoffs/p02-m02-t01-customer-schema.md).

## Next task

P02-M02-T02 customer_agent and P02-M02-T03 customer_document are READY; 0221/0222
are free. Registration must await both. No registration API/UI was built in T01.
Do not mark full customer onboarding complete from the table alone.

## Integration notes

Runtime customer access is denied pending M1's scoped grants/RLS. Customer audit
binding needs customer_id resolved before branch_id in the existing generic function.
Other owners' implementation files were not changed. Existing Phase 1 organization
work remains as implemented; this session's regressions pass.

At session start, earlier closeout edits/checkpoint were absent from the clean checkout.
User approval to proceed persists; [historical approval](../checkpoints/phase-01-checkpoint.md)
records the condition without recertifying that missing work. Keep publication under
user control and do not run the destructive legacy migration test on the development DB.
