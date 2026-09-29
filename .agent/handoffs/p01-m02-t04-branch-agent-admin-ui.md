# P01-M02-T04 — Branch and Agent Admin UI

## Delivered

- `/branches`: authorised active/all listing, ADMIN-only create form and confirmed
  deactivation.
- `/agents`: authorised active/all ordinary-agent listing, ADMIN/BRANCH_MANAGER create
  form and confirmed deactivation.
- Branch-manager branch selection is populated through the already-scoped branch API.
- Mutations use the login-issued CSRF cookie and the existing POST/PATCH endpoints.
- Deactivated records remain visible through the all-records filter; no delete action is
  exposed.
- `tests/e2e/branches-agents.test.mjs` covers branch and agent create/list/deactivate.

## Database impact

None. T04 uses the schema, audit triggers and grants delivered by T01–T03.

## Next dependency

Member 2's Phase 1 slice is complete. Phase 2 remains gated by OQ-05.
