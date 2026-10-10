# ADR-0026 — final local documentation and dependency closeout

Date: 2026-10-09. Status: user-authorized scoped implementation.

Vibodha confirmed proceeding with P06-M02-T03 and explicitly authorized necessary
other-owner implementation/fixes and local commits. Documentation consistency means
verified code and task evidence; dependency completion includes security and operational
verification. Live HTTPS deployment is explicitly excluded by the user's answer.

Blueprint ready: inventory current dev; repair discovered security/report gaps with
new migrations only; verify route injection and role coverage, direct least-privilege
RLS, disposable backup/restore and migration atomicity; complete necessary missing
FD surfaces; run combined isolated tests, typecheck/lint/build; reconcile docs,
review, save memory and commit locally. No push, PR creation or merge.

RLS is scoped by the account relation (including customer holder ownership), rather
than optional attribution columns on legacy ledger rows. SELECT inherits account
visibility; INSERT additionally requires a writing role. Existing immutability grants
and triggers are retained. Test context is trusted server session context; RLS is not
claimed to defend against stolen application credentials forging that context.

General phase checkpoint and lecturer decisions remain separate from scoped approval.
See the cross-owner handoff for ownership and final evidence.

The final consistency pass additionally found G-27: the implemented ADMIN reversal
permission contradicted the manager-only docs/05/M4 contract. 0626 restores that existing
rule, adds durable API key replay and constrained reversal controls, without editing merged
0363. Synthetic seed/legacy fixtures use real managers. Prototype M4 pages are explicitly
incomplete; their statuses are corrected rather than declaring global UI acceptance.

G-28 corrects the existing withdrawal adapter contract: customer identity is resolved
from the active linked profile; staff supply explicit one-holder or array evidence;
sp_try_post_withdrawal commits known rejection audits before the service maps errors.
No new schema is required; merged 0363 already defines this database contract.
Physical signature collection UI and prototype transaction pages remain pending.

Real runtime tests additionally required 0627: customer account UPDATE RLS blocks
FOR UPDATE, even on a readable owned account. Preserve that direct-write denial,
adding only a guarded pinned-path customer posting wrapper around the existing
locked core. Specific docs/05/M4 customer-withdrawal contract governs this operation;
ADR-0007 identity/inquiry support remains unchanged.
