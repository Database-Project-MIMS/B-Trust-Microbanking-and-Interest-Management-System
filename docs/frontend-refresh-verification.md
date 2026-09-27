# Emerald refresh and login repair

The user approved modern surfaces and GSAP, superseding prior visual restrictions.
The refresh covers sign-in, shared navigation, dashboard and shared table/form styling.
The user-deleted agent files were left untouched.

## Login root causes resolved

- Existing migration checksums matched LF content, but Windows checked out CRLF.
  The runner now accepts equivalent line endings while still rejecting SQL changes.
- Four pending migrations were applied to the local database, then existing demo seeds
  and application grants. No database was dropped and no password was reset.
- Production builds had overwritten dev bundles, leaving 404 JavaScript requests.
  Development now uses `.next-dev`, production uses `.next`.
- Sign-in rejects external/protocol-relative return destinations. The form uses POST
  so credentials are not placed in a query string before hydration.

## Verification

- TypeScript and ESLint pass.
- Production build completes successfully.
- All five authentication tests pass (password verification, invalid credentials,
  successful login, throttling, session revocation).
- Browser sign-in with the seeded administrator reaches the authenticated dashboard.
- No browser console errors during the verified login.

Apply grants on other local installations using `npm run db:grants` after migrations.
