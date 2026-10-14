# Scope reconciliations — 2026-10-14

OQ-36 resolved by the user's current request / ADR-0036: customer transfers now
replace withdrawal, superseding the older staff-only-transfer/customer-withdrawal
policy. Deposit/withdrawal user-facing channel becomes method=CASH|CHEQUE;
historical physical transaction_channel names/FKs remain for compatibility.
Current contracts/rules/schema/security docs are updated in this delivery.

Process reference conflict resolved using the more specific docs/11 guidance:
the root ui-registry.md and ownership map were retired on main. UI imprint is
recorded in docs/11_ui-rules.md; slice stewardship uses docs/08 and the cross-owner
handoff. No ownership transfer or broader phase/publication approval is inferred.
