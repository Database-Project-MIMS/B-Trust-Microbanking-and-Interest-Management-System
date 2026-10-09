# MIMS Demonstration Script — Current Local Implementation

Use synthetic data and `docs/10_local-setup.md`. Start with `npm run verify:phase1`
for isolated rebuild/test/type/lint/build evidence. This is a local demonstration;
live HTTPS verification remains pending by user instruction.

1. ADMIN: show branches, staff identity/roles, parameters and health. ADMIN is not a
   universal financial operator. Show the handler permission matrix in docs/19.
2. AGENT (`agent_c1`): register/search a customer, view their documents/assignment,
   open an individual or joint savings account. Show age/holder/minimum rejection and
   audit atomicity. Customer/account pages are live; use a funded active account for FD.
3. Financial posting: use authenticated deposit/withdrawal APIs with CSRF and a stable
   Idempotency-Key. Some transaction pages remain WorkflowScreen prototypes, so do not
   present their buttons as executed transactions. Show exact balance_after/ledger/audit
   in the real API response and SQL evidence. Repeat the same key, change its payload,
   attempt overdraft/minimum failure, and show no second/partial effect.
4. BRANCH_MANAGER: invoke reversal API with CSRF and a stable key for an own-branch posting; show replay and the actual receipt UUID. ADMIN is denied. Show compensating
   ledger row and rejection for another branch. Statement API provides running balances.
5. AGENT/BRANCH_MANAGER/CENTRAL_OPS: `/fixed-deposits/new`, choose eligible account,
   active effective product and principal. Preview the SQL balance; explicitly confirm.
   Show one principal debit, FD snapshot, audit and receipt. Retry the key and attempt a
   second active FD. `/fixed-deposits` displays scoped current/history rows.
6. ADMIN/CENTRAL_OPS: `/interest-runs`, select a due cycle, preview, confirm, show actual
   totals/exceptions/history. Repeat the cycle and prove no duplicate payout/credit. Use
   fault-injection test evidence to show a later FD/finalization failure cannot roll back an
   earlier committed distribution. Current distributions are FD-only, not savings interest.
7. AUDITOR/BRANCH_MANAGER/CENTRAL_OPS/ADMIN: show report pages. RPT-03/RPT-04
   now use real APIs and shared tables/filters. Show scoped SQL totals and CSV equivalence;
   RPT-04 regenerates subtotals from scoped leaf rows. Show report-access audit.
8. AGENT (`agent_k1`): attempt cross-branch read/write. Show direct mims_app RLS tests,
   immutability tests, permission denial state fingerprints and injection evidence.
9. Run `npm run verify:operations`: show full backup/restore comparisons and atomic
   migration/checksum tests. Existing development database remains untouched.

Accepted savings interest (ADR-0012), transfers (ADR-0010), remaining prototype UI wiring,
interactive browser verification, general phase/lecturer acceptance and live deployment
remain pending. This demo must not claim all SRS acceptance criteria are complete.
