# ADR-0033 — Customer registration and assigned-agent details

Date: 2026-10-11. Status: accepted for local implementation by the user's request.
Task: P02-M02-T06, a scoped follow-up to completed P02-M02-T05.
Branch: `feat/p02-m02-customer-details`, based on the current verified local checkout
including the previous live-audit corrections. Local commits are authorized; no push,
PR, merge or deployment.

The user clarified that the customer section must show the customer's email and
NIC/passport number to the agent, rather than the agent's own contact information.
An authenticated active AGENT may receive these complete fields only for customers
currently assigned to them in their branch. Existing SQL scope, actor revalidation,
RLS and safe not-found responses remain mandatory. Manager masking and the existing
bankwide/self-reader behavior remain unchanged. This supersedes the earlier blanket
branch-staff response masking in docs/04, docs/05 and docs/07; it is consistent with
FR-CUS-04's masking from unauthorized users. Audit identity masking remains unchanged.

Blueprint: replace registration's free-text gender input with a native select for
MALE/FEMALE, labeled Male/Female; retain the optional empty choice. Validate these
values on the server. Existing nullable varchar storage and historical values remain
valid; no database migration or financial rule is needed for a form choice restriction.
Add an explicitly named View details link on each search result, using the existing
authorized profile route. Include gender in that profile along with its existing
contact information, assignments, documents, accounts and fixed deposits.

Verify positive and invalid registration choices, assigned-agent full fields and
assignment/branch denials under the application role. Check actual browser dropdown,
navigation and profile rendering in a disposable local preview, including mobile.
Run the existing isolated rebuild/test/typecheck/lint/build checks, then review and
imprint the existing tokens. M2 retains all implementation ownership; registry/state
updates document this authorized contribution without ownership transfer.
