# ADR-0036 — Customer transfers and posting methods

2026-10-14 · P06-M04-T03 · user-requested scoped enhancement.

The user authorizes a local branch from latest main, customer transfers replacing
customer withdrawal, and Cash/Cheque methods on staff deposit/withdrawal forms.
No commit, push, merge, PR or deployment is authorized. This scoped task does not
approve general phase entry. Existing transfer/posting dependencies are implemented.

Customers may debit only an active account they hold and credit an active account
they do not hold, including another branch. The authenticated stored customer is
the sole signer; ALL_HOLDERS mandates cannot be satisfied by asserting other
signers. A pinned-path database function locks both accounts in UUID order, checks
stored identity/ownership/status/mandate/minimum/debit limits/business hours, and
posts an equal pair with balances and audit in one service-owned transaction.
Customer receipts expose only their debit and source balance. Recipient account
numbers are entered directly; no recipient listing or private balance is exposed.

Staff deposit/withdrawal APIs use `method=CASH|CHEQUE`. These values resolve to
new reference rows in the existing `transaction_channel` table. Historical
BRANCH_COUNTER/ONLINE/SYSTEM rows and financial foreign keys are preserved;
their physical names remain compatibility details. Old customer withdrawal
capability is revoked and the withdrawal core denies the CUSTOMER role.

The request authorizes necessary M1 navigation/API permission tests, M3 rules/schema
documentation, and M4 financial/UI changes; original stewardship remains.
The root UI registry/ownership map were retired on main; docs/11 and docs/08
are the current references. Skills are applied within the explicitly authorized
implementation, with review findings addressed before delivery.
