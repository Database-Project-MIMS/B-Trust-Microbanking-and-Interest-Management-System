# Frontend standardisation handoff

**Date:** 27 September 2026  
**Requested by:** project user  
**Affected owners:** M1 (authentication and app shell), M5 (FD products)

The user requested a project-wide frontend repair. The existing frontend includes non-MIMS
"spatial/crypto" mockups, simulated authentication, and fake card/CVV data. To return the
application to the approved UI and API contract, this change updates the shared shell and
sign-in screen, integrates the existing FD product page with that shell, and replaces
unsupported demo dashboard routes with explicit unavailable states. It does not change
database schema, services, or financial business rules.

Please review any follow-on feature work against the new shared components and the updated
`ui-registry.md` baseline.
