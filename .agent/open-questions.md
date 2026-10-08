# Open Questions

Raised during Phase 0 while reconciling the brief, SRS and ERD. Each entry says what it
blocks so nobody discovers the dependency by surprise.

## Blocking (must resolve before the phase noted can _finish_)

### Account opening blocked: no document verification path — 2026-10-08 (raised by M3, owner M2)

`sp_open_savings_account` and `sp_add_account_holder` require every holder to have a verified document
(`DOCUMENTS_NOT_VERIFIED`, ERD Assumption 3). Registration only inserts unverified documents and the RLS policy
`customer_document_insert_scope` forbids verified rows, and no endpoint or page sets `verified_by`/`verified_date`.
Result: an app-registered customer can never be opened an account through the UI (found in the 2026-10-08 browser pass).
Needed: a scoped verification endpoint and UI (and the role lock narrowing already noted in `current-state.md`), or
seed data with verified documents so the demo works. Blocks the Phase 2 exit demonstration. Not an M3 file change.

### Seeded branch managers cannot hold a session — 2026-10-08 (raised by M3, owner M1/M5)

Seed users `bm_colombo`, `bm_kandy`, `bm_galle` have no `agent` row. `validateSession` (`lib/auth/session.ts`) requires an
ACTIVE `agent` row for AGENT and BRANCH_MANAGER, so login returns 200 and then every page redirects to `/sign-in`
(also `branchId` is null in the login response). The account wizard and customer registration are meant for
BRANCH_MANAGER too, so they cannot be exercised. Needed: decide whether branch managers get `agent` rows (seed and
`assertBranchProfile` expectations) or a different branch link, and fix the seed or the session query. Not an M3 file change.

## Non-blocking (approve when convenient, nothing is waiting on these)

### Agent activity task-card branch/date shorthand — resolved 2026-10-08

The T02 card's current `agent.branch_id` filter alone could expose a transferred
agent's previous branch amounts. Its timestamp BETWEEN shorthand also omits the
final day's activity when supplied plain dates. ADR-0017 keeps the prescribed
current-agent branch gate and adds an immutable posting-branch filter for managers;
inclusive Asia/Colombo days use half-open timestamp bounds. The task card and API
contract are updated together. No schema change or general phase approval.

### Seeded branch-manager profiles missing — 2026-10-08

Clean rebuild supplies bm_colombo/bm_kandy/bm_galle logins but no required active
agent branch-staff profiles (ADR-0006). Sign-in succeeds then session validation
fails closed. M5/M1 handoff: handoffs/p03-m02-activity-seed-manager-profile.md.
T02 browser fixtures add the missing profile only in the disposable database;
no steward-owned seed or another member's task status is changed here.

### Incoming Phase 2 seed targets versus phase exit — 2026-10-08

PR #48 (dev 2208986) marks M5-T01 DONE and revises docs/06 to 15 customers,
10 accounts and 2 joint accounts. docs/phases/phase-02-customers-and-accounts.md
still requires 18 customers, 22 accounts and 3 joint accounts. PR #49's tracker
resolution preserves the seed owner's DONE status and incoming specification;
it does not silently amend those exit criteria or approve phase exit. M5/the lead
must reconcile the targets before Phase 2 exit verification. This does not block
the separately authorized T01 attribution schema or its tracker resolution.

### Customer contract discrepancies recorded 2026-10-05

- G-10/task card says "exactly one", but the prescribed partial index only enforces
  **at most one**. Implemented T04 now supplies existence at registration commit;
  future reassignment must preserve it. Direct owner inserts can still omit assignments.
  The phase's full one-current-assignment exit stays open.
- Child ERD/card omits some lifecycle timestamps. Apply AGENTS.md §8's required
  created_at/updated_at with shared triggers; docs/04 B.4a and docs/17 G-10 record them.
  Migration recording follows actual filename/checksum runner, not card version/name SQL.
- docs/15's permission matrix permits ADMIN registration while docs/05 and the specific
  M2 task card list AGENT/BRANCH_MANAGER. T03 verification and T04 registration follow
  the narrower mutation contract and deny ADMIN (ADR-0014). T05 preserves this restriction;
  M1 should reconcile docs/15 without broadening runtime mutation roles.
- Tracker T05 describes frontend work; the specific 06 task card describes API integration
  with prebuilt dashboard screens. Inspection found prototypes in
  components/mims/workflow-screen.tsx, not completed dashboard customer bindings. T04
  services were completed in T04; authenticated live routes/screens are completed by T05.
- Historical missing-runtime blocker resolved by merged M1 0200/0201/0261 and T05 0223.
  Customer routes use all three transaction-local RLS values and the customer audit trigger.
  Current tests use migrated mims_app grants/policies, with no temporary child grants.
- Pre-existing T03 verifyDocument locks role FOR SHARE, requiring an absent write grant.
  M2 must narrow that lock before verification endpoint exposure; retain read-only role
  permissions. T04 locks only writable staff/user/branch rows and its app-role test passes.
- M3 account_holder is merged (0241). T05 reads the real relation; fixture tests no longer
  create/drop a substitute table. Empty account arrays mean no links; balances stay strings.
- Shared overview/state records lagged the merged tracker: M1's overview struck T03 as
  complete while its tracker row is TODO, and M3's overview still awaited the holder table.
  2026-10-07 summary reconciliation uses existing tracker rows; no new other-member completion.
  Historical PR #36 conflict-resolution notes retain their original dated snapshots.

| ID    | Question                                                                                   | Recommendation                                                                                                   |
| ----- | ------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------- |
| OQ-06 | Should `audit_log` capture read access, or only writes?                                    | Writes always; report _generation_ also audited (REP-COM-06); ad-hoc reads not logged — volume vs value tradeoff |
| OQ-07 | Is there a maximum number of accounts per customer?                                        | No stated limit in brief/SRS; leave unconstrained, revisit if abuse becomes a concern                            |
| OQ-09 | Should closed accounts be excluded from reports by default, or shown with a status column? | Shown with a status column — hiding history breaks reconciliation                                                |
| OQ-10 | Does `customer_document` need file storage, or just metadata (type, number, expiry)?       | Metadata only — no file upload requirement anywhere in the brief or SRS                                          |

> **Numbering warning:** `docs/02_srs-summary.md` §TBD table uses OQ-06, OQ-07, OQ-09 and
> OQ-10 for _different_ questions (FD maturity, withdrawal limits, hosting, submission
> artifacts). This file is the authority for OQ numbers; the SRS table needs reconciling.

## New items raised by the 2026-10-02 decisions

| ID    | Question                                                                                                                                                    | Needed before                |
| ----- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------- |
| OQ-11 | How does a newly registered customer receive their first credential (temporary password, forced change, invite)?                                            | P02 customer registration UI |
| OQ-12 | Transfer transaction typing: one `TRANSFER` type with direction, or separate out/in types?                                                                  | P03 `transaction` schema     |
| OQ-13 | Does an account opened or closed mid-cycle earn interest for the days it was open? (assumed yes)                                                            | P04 `sp_run_interest_cycle`  |
| OQ-14 | Does the lecturer accept customer self-service and transfers, given the SRS says self-service is "limited to inquiry functions" and transfers out of scope? | Before Phase 3               |

## Resolved

### P03-M02-T01 scoped early start and task-card reconciliation — 2026-10-08

After being informed of the phase gate and G-07 decision, Vibodha instructed
"so lets do them" and "do the task now". ADR-0016 records authorization for the
prescribed nullable attribution schema and T01's early start only. Phase 2 exit,
general Phase 3 entry and OQ-12/OQ-14 remain unresolved. M4's schema handoff already
reserves these columns for M2; M4 review of the outgoing contract remains required.

The task card used a nonexistent `posted_at` column and an obsolete
`schema_migration(version, name)` insert. Implementation uses `transaction_date`
and the runner's filename/checksum ledger, matching the actual merged schema.
No existing migration or other member's posting routine is edited. NULL legacy
attribution is preserved, and producer integration remains separately assigned.

### Documentation/status contradictions — 2026-10-05 closeout

The user authorized resolving checks, reconciling statuses and recording approval.
The old AGENTS header/memory/member stubs still described Phase 0; the Phase 1
document counted 18 tasks although the tracker lists 19; five tracker READY rows
were already implemented (its summary incorrectly counted six). Member 4's channel,
runner/health and Phase 2 transaction code existed despite stale statuses.

Resolved from 184 passing tests, clean rebuild and verified migration inventory:
Phase 1's 19 implementations are DONE locally; Phase 2 entry is approved by Vibodha;
account and transaction schema tasks are DONE; customer schema was READY at closeout. The checkpoint
explicitly preserves user-controlled publication and does not claim lecturer approval.
The more specific tracker/phase evidence now overrides the obsolete headers.

Implicit dependencies were made explicit: customer/account audit coverage needs those
tables, and registration needs both assignment and document tables. Full seed work uses
the phase/seed specification's 3 joint accounts rather than the stale tracker count of 2.
The old OQ-01/04/08 blocked register and Member 4 overview no-transfer reminder were
reconciled with ADR-0010/0011/0012; OQ-12/13/14 remain unresolved future-phase gates.
No new financial schema decision or migration was introduced.

### P02-M02-T01 source/documentation reconciliation — 2026-10-05

The user approved Phase 2 entry earlier in this conversation and explicitly requested
customer-schema implementation. The clean checkout at 3fe8689 had older TODO/
Phase 0 headers and no earlier uncommitted closeout files. The restored historical
checkpoint records approval without claiming those absent repairs are integrated.
This task proceeds under the user's retained authorization; other task statuses are
not recertified by the customer-schema change.

Part B.4 is expanded to match the approved task card's customer_number, lifecycle,
required fields and timestamps. The card's example schema_migration(version,name)
insert is corrected: the actual runner records filename/checksum. No new identity
decision is needed; ADR-0007 remains authoritative.

### PR #34 conflict reconciliation — 2026-10-06

The missing closeout files are now committed on `origin/dev` (fad4f13, integrated by
76701e7/PR #33). Conflict resolution retains that checkpoint/evidence and the implemented
0220 customer schema. Phase 1 remains 19 DONE; Phase 2 is 3 DONE/2 READY/11 TODO in this
PR's tree. T02/T03/T04 delivery on later feature branches is not imported here. Earlier
184-test/65-test evidence is historical; the combined tree is verified separately.
PR #34 targets the actual integration branch `dev`; generic `develop` examples describe
the same integration role. No branch rename, new phase approval or financial schema
decision is introduced. Commit/push/merge remain the user's actions.

### PR #35 conflict reconciliation — 2026-10-06

This feature branch predates dev's Phase 1 closeout (fad4f13, integrated by PR #33 as
76701e7), causing repeated conflicting status snapshots. Targeted resolution retains
dev's checkpoint/security/tooling and this branch's implemented 0220/0221/0222 and
document service. Phase 1 stays 19 DONE; Phase 2 is 5 DONE/1 READY/10 TODO here.
T04's later implementation remains on its own branch. Old missing-closeout warnings
are historical. No new phase approval, schema decision or migration edit is introduced.
PR #35's actual target is dev; generic develop examples describe the same integration role.

The relation-test committing guard recognized only the focused harness database. It
now also accepts mims_test_closeout exclusively with MIMS_ISOLATED_TEST=1, allowing
the restored full isolated harness without permitting mims_dev or arbitrary databases.
A regression verifies accepted isolated names and rejected development/unapproved names.
Runtime verification still requires M1's scoped grants/RLS. verifyDocument's pre-existing
FOR SHARE role lock needs narrowing before endpoint exposure; no broad role UPDATE
grant is added and no business-code change is included in this conflict-resolution task.

### PR #35 refresh after PR #34 merged — 2026-10-06

The PR-specific snapshots above describe the earlier resolutions. PR #34 is merged
into dev at 2e338a6, while PR #35's earlier resolution is user-committed as 07e878d.
Their shared status documents diverged during those independent resolutions; nine
new documentation conflicts are reconciled without a service/migration change.
T01 is now merged; T02/T03 remain DONE in this PR's tree and T04 READY here.
Fresh evidence is in the [refresh handoff](handoffs/p02-m02-t02-t03-pr35-dev-refresh.md).
Later registration work stays on its branch; no new approval or runtime access claim.

### PR #36 conflict reconciliation — 2026-10-06

This branch predates dev's Phase 1 closeout (fad4f13/PR #33). Resolve overlapping
status histories while retaining both implementations: Phase 1 19 DONE, Phase 2
6 DONE/1 BLOCKED/9 TODO in this PR's tree. T01–T04 are delivered; T05 still needs M1
scoped grants/RLS/audit and real screen binding. Old missing-closeout conditions are
historical; no new phase approval or migration/schema decision is introduced.

Two different records used ADR-0013. Preserve dev's closeout record; renumber the M2
customer numbering/scope record to ADR-0014 and update its references without altering
the decision. Test integration retains disposable-only fixture restrictions and supplies
mims_app membership to the disposable owner only in the fresh cluster bootstrap, never
owner membership to the application role. Runtime grants/RLS are unchanged. Target is
actual dev; generic develop examples refer to the same integration role.

The combined run exposed committed holder-fixture accounts contaminating the later
seed minimum check. M2's test now deletes only its tracked fixture account IDs after
removing the temporary holder table. The rerun passed all 328 tests and the clean
14-migration rebuild/typecheck/lint/build; seed rules and service logic are unchanged.

### PR #36 refresh for PR #35-then-#36 order — 2026-10-06

The snapshots above describe each earlier resolution. PR #34 is merged into dev
2e338a6; PR #35's latest resolution 888b983 includes that tip and remains pending
PR merge. The user orders #35 before #36. PR #36 at 5ef06fd prepares an uncommitted
merge of 888b983 and reconciles nine overlapping documentation conflicts. Preserve
T01–T04 DONE/T05 BLOCKED in this tree, both ADR-0013/0014 and the disposable SET ROLE
harness membership. No new service, migration, runtime grant or phase approval.
Fresh evidence is in [the dependency handoff](handoffs/p02-m02-t04-pr36-after-pr35.md).


### OQ-05 — Customer login is optional

- **Resolved:** 2026-09-29
- **Decision:** Customers are primarily agent-managed and may exist without a login.
  `customer` receives an independent surrogate `customer_id`; an optional unique
  `app_user_id` links only customers who are later granted self-service access.
- **Effect:** G-20 and TBD-02 are resolved. `P02-M02-T01` is no longer blocked by the
  customer identity decision, but Phase 2 still requires its normal entry checkpoint.
- **Record:** `.agent/decisions/ADR-0007-optional-customer-login.md`.

### OQ-01 — Second FD after the first closes? — **2026-10-02**

One **active** FD per savings account; a new one is allowed after the previous matures or
closes. Partial unique index on `status = 'ACTIVE'` replaces the ERD's plain `UNIQUE`.
→ [ADR-0011](decisions/ADR-0011-one-active-fd-per-account.md)

### OQ-04 — Do savings accounts accrue interest? — **2026-10-02**

Yes. The 30-day cycle processes both savings accounts and FDs. Savings interest uses
**average daily balance** over the cycle, actual/365. `interest_payout` gains `account_id`
and `source_type`; `fd_id` becomes nullable.
→ [ADR-0012](decisions/ADR-0012-savings-interest-average-daily-balance.md)

### OQ-08 — Do inter-account transfers exist? — **2026-10-02**

Yes. Each ledger row keeps a unique `reference_number`; a nullable `transfer_group_id`
links the debit and credit legs. ERD Assumption 4 is dropped.
→ [ADR-0010](decisions/ADR-0010-transfers-with-transfer-group.md)


## How to resolve one

1. Discuss with the group (and the lecturer, if flagged as a lecturer question).
2. Move the entry to **Resolved** with the decision and date.
3. If it affects schema, architecture, or a cross-member contract: write an ADR in
   `decisions/`.
4. If it unblocks a task, update that task's status in `docs/09_task-tracker.md`.

## P02-M01: migration number outside M1 block (resolved by user, 2026-10-06)
0200/0201 (M1 block) run before customer 0220 / account 0240, so triggers and RLS policies cannot bind there. Functions stay in 0200/0201; binding is 0261_p02_m01_rls_audit_bind.sql (outside 0200-0219). Watch for M4 using 0261 in its own block (different filename, no clash).

### P02-M03-T05 account opening idempotency — 2026-10-07

`POST /api/accounts` is money-moving (optional initial deposit) and AGENTS §9 requires an
`Idempotency-Key`. G-04 only covers `transaction.idempotency_key` (M4, Phase 3). Decision (confirmed by
the user, Member 3): a separate insert-only table `account_opening_request` (migration 0244) keyed
`UNIQUE (user_id, idempotency_key)` with a request hash and `account_id`, written in the same
transaction as the account. No other member's table or file was changed. Holder additions use a new
routine `sp_add_account_holder` (0245) so the verified-document rule lives in the database.

## P04-M02-T01 scoped early start and read-policy coordination — 2026-10-08

Vibodha explicitly requested implementation after the incomplete opening dependency
and phase gate were explained. ADR-0018 authorizes the read-side task only. 0480 is
merged; M5 notes still describe P04-M05-T02 as partial. No general Phase 4 entry or
OQ-13/OQ-14 approval is inferred. M2 uses disposable synthetic FD rows, not the partial
opening routine. M1/M5 review the new SELECT-only FD RLS/column grants in 0420; no
owner source files/write policies are changed. The numbering/start_date discrepancies
are resolved in ADR-0018 and docs17; broader opening/interest integration stays pending.
