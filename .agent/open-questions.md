# Open Questions

Raised during Phase 0 while reconciling the brief, SRS and ERD. Each entry says what it
blocks so nobody discovers the dependency by surprise.

## Blocking (must resolve before the phase noted can _finish_)

### AC-12 seed coverage — resolved locally 2026-10-09 (P06-M02-T01, steward M5)

Strict read-only validation after a clean disposable rebuild of dev 095ea9c finds
3 branches, 6 ordinary agents, 15 customers, 2 valid joint accounts and 125 ledger
rows. Organization assignment checks pass. However fixed deposits = 0 (minimum 10),
interest runs = 0 (minimum 2), payouts = 0, and three configured active roles have
no active user. `_load-order.txt` lists `14_fixed_deposits.sql` and
`15_interest_runs.sql`, but neither file exists. The old `seed-check.mjs` skips
empty datasets and its `account.mandate_type` query does not match the schema;
its success is not evidence of global AC-12 compliance.

The preceding counts are historical. Vibodha subsequently instructed “complete
this,” authorizing M2's necessary M5/M4 contribution. Global seed validation now
passes: twelve funded FDs, three nonempty completed runs, thirty payouts, 191
postings, all seven roles, customer links and manager staff profiles. Per-account
signed-ledger reconciliation and payout/control checks pass. The specification
records actual counts/totals and the runtime-generated timestamp limitation.
Merged migrations are unchanged; new 0620 repairs interest references. T01 is
REVIEW awaiting user publication. See [current evidence](handoffs/p06-m02-seed-validation.md).
The reported integration failures have also been repaired under explicit authorization;
current865 and latest-dev overlay940 full tests pass. General phase gates remain
separate. The normal DB is preserved.

### Account opening blocked: no document verification path — 2026-10-08 (raised by M3, owner M2)

`sp_open_savings_account` and `sp_add_account_holder` require every holder to have a verified document
(`DOCUMENTS_NOT_VERIFIED`, ERD Assumption 3). Registration only inserts unverified documents and the RLS policy
`customer_document_insert_scope` forbids verified rows, and no endpoint or page sets `verified_by`/`verified_date`.
Result: an app-registered customer can never be opened an account through the UI (found in the 2026-10-08 browser pass).
Needed: a scoped verification endpoint and UI (and the role lock narrowing already noted in `current-state.md`), or
seed data with verified documents so the demo works. Blocks the Phase 2 exit demonstration. Not an M3 file change.

### Seeded branch managers cannot hold a session — resolved locally 2026-10-09 (raised by M3, owner M1/M5)

The authorized seed completion adds active manager profiles in `03_agents.sql`
for `bm_colombo`, `bm_kandy` and `bm_galle`, with their correct branch links.
All manager/staff profile checks pass. The M1 session query remains unchanged.
Publication is pending with P06-M02-T01; the following report is historical.

Seed users `bm_colombo`, `bm_kandy`, `bm_galle` have no `agent` row. `validateSession` (`lib/auth/session.ts`) requires an
ACTIVE `agent` row for AGENT and BRANCH_MANAGER, so login returns 200 and then every page redirects to `/sign-in`
(also `branchId` is null in the login response). The account wizard and customer registration are meant for
BRANCH_MANAGER too, so they cannot be exercised. Needed: decide whether branch managers get `agent` rows (seed and
`assertBranchProfile` expectations) or a different branch link, and fix the seed or the session query. Not an M3 file change.

## Non-blocking (approve when convenient, nothing is waiting on these)

### M5 ops status differs between notes and tracker — 2026-10-09 (owner M5)

During PR #88 conflict resolution against dev78aae1e,
`5_Selith/notes/notesP6T2.md` claims P06-M05-T02 DONE, while the incoming
`docs/09_task-tracker.md` row has no status. The resolution retains TODO, rather
than certifying backup/restore/migration evidence from a status note. M5 should
reconcile the authoritative row with its execution evidence. This does not block
the seed/conflict delivery or imply general Phase 6 acceptance.
[Resolution handoff](handoffs/p06-m02-pr88-conflict-resolution.md).

### 27 failing tests on dev 93a82f8 — resolved locally 2026-10-09 (found by M3, owners M1/M4/M5)

The historical failures below, and the 29 later observed on dev78aae1e, are
resolved in the authorized M2 contribution: real sessions/RLS fixture context,
audit contracts, database date boundaries and typed withdrawal calls. Full
current865/latest940 suites pass; user publication remains pending. See the
[integration handoff](handoffs/p06-m02-integration-failure-repairs.md).

A clean export of origin/dev (735 tests, 75 suites) fails 27 tests; the same 27 fail with M3's P04-M03-T01 change. Most are
`invalid input syntax for type uuid: "<64 hex chars>"` (a session token id used where a UUID is expected) or
`new row violates row-level security policy for table "customer"` in fixtures. Failing suites: `P05-M01-T04: Audit API`,
`Cycle Config Service and Admin API`, `P03-M01-T03: Financial Audit Service Writers` and `…Event Helpers`,
`P04-M01-T01: Interest Run Worker Authentication`, `P03-M01-T02: Manager-Only Reversal Authorization`,
`P03-M04-T04: sp_reverse_transaction`, `P04-M04-T02: Transaction running balance is monotonic`. Each owner should re-check
their suite against the merged schema/session code. (The earlier `sp_post_withdrawal` 42809 defect was repaired upstream by 0363.)

### Account closure: card SQL corrections and decisions — 2026-10-08 (raised by M3, task P04-M03-T02)

(1) The card's `sp_close_account` wrote audit rows with `before_value` / `after_value`, which do not exist; the table has
`old_values` / `new_values`. (2) The card did not check account status. Implemented: only an ACTIVE account closes, a
FROZEN one is rejected with `ACCOUNT_NOT_ACTIVE`, a CLOSED one with `ACCOUNT_ALREADY_CLOSED`; there is no unfreeze path yet,
so a FROZEN account cannot be closed in the app (team decision if that is wrong). (3) Beyond the card, a database guard
trigger (`trg_account_close_guard`) enforces zero balance and no ACTIVE FD on any direct `UPDATE` to CLOSED, because the
caller-side FD check can miss rows hidden by `fixed_deposit` RLS. (4) Backend only; the Close button is not built.
(5) Suggestion for M5: the database does not stop an FD being inserted for an already CLOSED account by SQL that skips
`sp_open_fixed_deposit` (the foreign key only checks the row exists); a `BEFORE INSERT` guard on `fixed_deposit` requiring an
ACTIVE account would close that. Handoff: `handoffs/p04-m03-t02-account-closure.md`.

### Account FD panel: visibility limit, placeholder link target, missing FD seed — 2026-10-08 (raised by M3, task P04-M03-T03)

(1) The panel reads `fixed_deposit` under the caller's RLS (0420/0421), which needs a holder in the caller's branch scope; an account
whose holders are all in another branch would show a manager no FDs (display only; closing is still blocked by the guard trigger).
(2) The "Open a fixed deposit" link goes to `/fixed-deposits/new?accountId=…`, which is M5's placeholder `WorkflowScreen` and ignores the
parameter. (3) `database/seed/_load-order.txt` lists `14_fixed_deposits.sql` (and `15_interest_runs.sql`) but neither file exists, so there is
no FD demo data. (4) No browser pass was run for the panel; its rendered markup is covered by `tests/e2e/account-fixed-deposits-panel.test.mjs`, but the visual layout (narrow width) was not looked at. Handoff: `handoffs/p04-m03-t03-fd-panel.md`.

### RPT-02 view: balance_after gaps, ledger ordering, seed dates — 2026-10-08 (raised by M3, task P05-M03-T01)

**Resolved by M3 (ADR-0023):** (1) `sp_open_savings_account` (0243) wrote the opening-deposit row without `balance_after`;
`0541` fixes new rows and the view derives the old NULL ones (the ledger is immutable). (2) `transaction_date` ties and inverts
(`sp_post_deposit` stamps `now()`, `sp_post_withdrawal` `clock_timestamp()`; the seed posts ~120 rows in one block). Measured on
the pure seed: 73 of 125 rows tied, 86 balance-chain breaks, 6 of 10 accounts' last row disagreed with `current_balance`.
`0542` adds `transaction.ledger_seq` (G-24); the seed now shows 0 breaks and 0 mismatches. (3) The view could fail on one
out-of-range row and scanned the whole ledger for branch queries; `0543` fixes both. (4) The task card's SQL used `posted_at` and
`status`, which do not exist. **Open, other owners:** (a) every seeded transaction carries the seed run time (one day), so
date-range reports over seed data show a single day although the seed card asks for rows "across dates" (M5, seed set 4).
(b) All 10 seeded accounts start with a balance that exists outside the ledger (first row's `balance_before` is not 0), so a
check that `current_balance` equals the sum of the ledger will not hold on seed data (M4's reconciliation, M5's seed).
(c) M4 should review the additive `ledger_seq` column on their table: `handoffs/p05-m03-ledger-seq-for-m4.md`.
Handoff: `handoffs/p05-m03-t01-rpt02-view.md`.

### RPT-02 report: scale, shared components, CSV behaviour — 2026-10-08 (raised by M3, task P05-M03-T02)

(1) **Scale (NFR-PERF-04, P06-M04-T02):** a multi-account RPT-02 request reads the scoped accounts' ledger history (one branch page 65 ms, bank-wide
176 ms at 40,000 ledger rows; a single account 0.3 ms via `ux_transaction_account_ledger_seq`) and runs the aggregate three times (totals, rows,
page subtotal). Fine for the sample data (NFR-PERF-03), several seconds per query at a million rows; a single-pass query would cut it to one.
(2) `components/report/**` (M1) got three optional props, `caption`, `emptyText`, `sortLabels` (defaults unchanged): `handoffs/p05-m03-report-shell-props-for-m1.md`.
`ReportFilters` still labels its branch select "Posting branch". (3) RPT-05's CSV (`app/api/reports/customer-activity`, M4) exports only the current page,
not every filtered row as REP-COM-04 and the shell's "Export CSV · all filtered rows" button promise; RPT-02 exports all rows. (4) No browser pass for the page.
Handoff: `handoffs/p05-m03-t02-rpt02-report.md`.

### I-6 task card versus tracker, plan minimum, and M5's inlined opening checks — 2026-10-08 (raised by M3)

The P04-M03-T01 card prescribes `fn_check_account_fd_eligible(account_id) → boolean` (status only; caller locks and
compares the balance), while the tracker title says "ACTIVE, sufficient balance, read under lock". Both are delivered
in migration `0440` (the card's prescribed file): the card function exactly, plus `fn_fd_funding_verdict(account_id, principal)` for a locked one-call check with reasons.
The tracker's dependency of T01 on P04-M05-T02 is circular (I-6 flows M3 → M5) and was not needed.
Open for M5/the team: (0) `fixed_deposit` RLS (0420/0421) hides FD rows from ADMIN contexts, so the `ACTIVE_FD_EXISTS` pre-check is best-effort and the unique index is the guard; also no write grant/policy on `fixed_deposit` for `mims_app` was found in the repo (not run-tested). (1) dev's `sp_open_fixed_deposit` inlines its own checks and does not call I-6, and it debits
`account.current_balance` with a bare `UPDATE` (no `transaction` row, no audit), against AGENTS.md §5; the I-5 posting path
is the intended route. (2) Should FD principal preserve the savings plan minimum (BR-09)? Not applied today; the card asks
only for ACTIVE + sufficient balance. Handoff: `handoffs/i-6-fn-check-account-fd-eligible.md`.

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

## P04-M02-T02 scoped access completion — 2026-10-08

T01 is merged (PR #60, dev e9291dc); its REVIEW label was stale. After the remaining
phase gate was explained, Vibodha said “do it now”, authorizing T02's read-side scope
only (ADR-0019). New 0421 ANDs a current stored-actor guard with 0420 FD SELECT scope.
M1/M5 review the additive restrictive policy; no ownership shift, write access or
owner source changes. General phase gates/OQ-13/OQ-14 stay pending. M2's route/service/
view inventory is covered; future M5/M3 FD/report read paths need their owner review.

## P05-M02-T01 scoped start and report SQL corrections — 2026-10-08

P04-M02-T02 is merged through PR #62 (dev 48f4185); its local REVIEW wording is
historical. Vibodha's “do it” authorizes P05-M02-T01 only (ADR-0020), with merged
P03-M02-T01 satisfied. General Phase 5 entry is not approved. The task card's
COUNT/date/index/current-branch examples are resolved in ADR-0020 and docs17;
0520 creates an owner-only invoker/barrier aggregate view and no ERD/table change.
T02 stays pending M1's I-7/CSV/access audit and runtime security integration.
M4 retains posting attribution and reversal-direction ownership; NULL attribution
is not backfilled and no signed net is guessed. All profiles in agent are reporting
identities, including the manager subtype, preserving inactive/role-change history.

## P03-M04-T03 corrective authorization and audit boundary — resolved 2026-10-08

Vibodha explicitly allowed changing/creating M4 work and requested its documentation
updates after shared withdrawal tests failed. ADR-0021 reopens T03 and retains M4
ownership. New 0363 replaces broken after_value/procedure-call/parameter-key behavior
without editing merged 0362 or changing tables. The audited array-signers attempt
rolls back inner financial work for known rejections, writes the outer audit and
returns a code; the future service commits that result, then maps an error outside
withTransaction. Actor/scope, I-4 ALL_HOLDERS, calendar/Colombo-day limits and replay
are verified. Full 663 tests /62 suites, 34-migration rebuild/checksums and type/lint/
build PASS, no exclusions. Earlier blocker resolved. T03 and M2 T01 remain local
REVIEW until user publication. T04 reversal/T05 API and I-7 work remain separate;
general phase approvals are not inferred. M1 audit/runtime review is in the handoff.
## RPT-01 runtime integration note (2026-10-08, ADR-0022)

Inspection finds no transaction RLS policy in the integrated migrations. T02 keeps
0520 private and exposes only fixed scoped aggregates through database-guarded
routines. Operational transaction visibility/writers retain their existing contract.
M1/M4 retain responsibility for the broader NFR-SEC-07 transaction RLS integration.
The user approved M1 report-interface repairs for this task; ownership is unchanged.

## Current full-suite integration failures (2026-10-08)

T02's relevant report checks pass, but the full merged-tree run has 767 tests:
729 pass, 27 fail, 11 cancelled. Legacy session fixtures use a token hash as the
UUID session primary key (22P02); older branch fixtures omit district (23502);
financial audit tests assume missing account fixtures/old event shapes; two older
withdrawal callers hit ambiguous overloads (42725). These files are unchanged by
T02. M1/M4 own their fixes; see p05-m02-rpt01-api-ui.md for exact files/evidence.
This prevents claiming full integration acceptance or general phase approval.
