# MIMS Demonstration Script — Current Local Implementation

Use synthetic data and docs/10. Run `npm run verify:phase1` for isolated rebuild,
complete tests, typecheck/lint/build evidence. Live HTTPS remains deferred.

1. ADMIN: show real `/admin/users` and `/admin/roles`, required staff/customer profiles,
   parameters and health. Show session revocation and private single-use reset issuance.
   Give reset links only to the verified synthetic user; no email sender is configured.
2. AGENT: register/search customer, verify documents, open an eligible individual/joint
   account; show age/holder/document/minimum errors and atomic audit evidence.
3. `/transactions/deposit`: search an active scoped account, enter exact cents, review,
   confirm, then open real receipt and statement. Repeat an API key and alter payload;
   show one effect or safe conflict. No prototype values are used.
4. `/transactions/withdraw`: staff record physical holder authorizations; CUSTOMER chooses
   only owned accounts and signs as its linked profile. Show overdraft, hours, mandate and
   daily-limit rejection without a debit. Statement shows posting order and running balance.
5. Staff `/transactions/transfer`: choose two own-branch accounts, source holder evidence,
   exact cents, review and confirm. Show both legs and the same transfer group; customer
   attempt is denied. BRANCH_MANAGER reversal of either leg compensates both or rolls back.
6. `/fixed-deposits/new`: searchable eligible account and effective product, SQL quote,
   confirm; show linked principal debit, FD rate/date snapshot, receipt and audit. Attempt
   a second active FD. List and customer profile show scoped current/history rows.
7. ADMIN/CENTRAL_OPS `/interest-runs`: preview then execute a nonfuture due cycle. Show FD
   catch-up dates, savings open/funded-day interest, independent payout totals/exceptions,
   automatic maturity principal receipt and completed-cycle replay. Use SQL fault tests to
   prove no partial distribution and that earlier successes survive later failures.
8. AUDITOR/management: five real reports and CSV equivalence, extended type totals/savings
   products, scoped rollups and report-access audit. `/admin/audit` filters actual history;
   `/reconciliation` compares exact ledger/current/last-posting balances.
9. Attempt another-branch/customer read/write; show direct mims_app RLS, immutable ledger,
   full role/endpoint denial fingerprints and injection probes.
10. `npm run verify:operations`: show every table's exact backup/restore, constraints,
    policies, ownership, sequences and atomic migration checksums.

See docs/21 for current test/browser evidence and limits. Normal account closure retains
zero balance/no ACTIVE FD and rejects unsettled interest; a dedicated final settlement
policy remains open. Peer/lecturer acceptance and live deployment are separate gates.
