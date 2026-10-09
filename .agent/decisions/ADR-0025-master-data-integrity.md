# ADR-0025 — Scoped P06-M02-T02 master-data integrity verification

**Date:** 2026-10-09 · **Owner:** M2
**Status:** Authorized by Vibodha; blueprint explicitly confirmed.

## Authorization

Vibodha instructed “lets do P06-M02-T02” and confirmed the concrete plan:
create `feat/p06-m02-master-data-integrity` from the clean current branch, add
database/API integrity tests, verify in a disposable database, and update task
documentation. Base is `fe7034f`, the user's completed seed/latest-dev merge.
Phase 2 dependencies are DONE in the authoritative tracker. This is a scoped
T02 exception; general Phase 6 entry and T03 remain separate.

Vibodha subsequently authorized fixing verification failures, including other
members' code, and local commits. No push, PR creation or merge is authorized.
Preserve ownership and document cross-owner changes before editing them.

## Blueprint

- Master data means M2's five tables: branch, agent, customer, customer_agent,
  customer_document. M3's project-wide constraint task remains separate.
- Integrity means adversarial SQL that proves keys, required fields, named
  constraints, assignment history, verification pairing and restrictive parent
  deletion, plus actual API calls that prove rollback and deactivation retention.
- Use synthetic per-test graphs and savepoints; database probes roll back.
  Committed API fixtures require the existing disposable-database guard.
- Compare named schema constraints and required columns with an explicit coverage
  manifest so additions cannot silently escape the suite. Probe duplicate INSERT
  and UPDATE, and partial verification in both directions.
- API calls use production session/CSRF handling and the real mims_app role.
  Rejected requests must retain master-row snapshots and audit counts, including
  a failed agent profile update after its login status was tentatively changed.
- Cover existing branch/agent PATCH deactivation routes; customer deactivation
  is direct owner SQL followed by scoped API reads. No customer PATCH/DELETE
  or document endpoint is implemented by this test task.
- Reuse the existing disposable customer verifier with an integrity selection.
  Rebuild, checksum verification, focused/full tests, typecheck and lint form
  the evidence. Never rebuild the configured development database.

No production behavior/schema/UI change is planned. A migration is required only
if an actual integrity defect needs an authorized additive correction. Update
the task card, tracker, index, phase notes and M2 state with measured results;
leave T02 REVIEW until user publication/review. Run /review and /remember save.
