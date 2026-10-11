# ADR-0032 — Reproducible Vercel build dependencies

Date: 2026-10-11. Status: accepted for local implementation under the user's
request to repair the deployment failure on existing PR #97 and earlier edit authority.
Branch: `feat/p06-m02-live-audit-fixes`; no push or hosted deployment is authorized.

Blueprint: remove the compiler dependency from configuration loading and explicitly
install the locked build toolchain before compiling. Preserve CSP, header behavior,
development/production output separation and Docker standalone behavior. Verify Next's
real loader with compiler resolution denied, then install/build a clean source copy
under production/omit-dev settings. Add recovery documentation and a cross-owner receipt.

Use `next.config.mjs` with JSDoc types instead of `next.config.ts`. TypeScript stays
in development dependencies for application compilation and type checking. Commit
`vercel.json` with `npm ci --include=dev` and `npm run build`; these override the
reported dashboard build command that installs a package during compilation.
No package versions, database objects, financial operations, application permissions
or install-script policies change. Original stewardship remains unchanged.

The supplied log proves the compiler was absent, but does not expose the dashboard's
environment settings. Omitted development dependencies are the supported diagnosis,
not a claim that those settings were inspected. Local verification is separate from
a successful new hosted Vercel deployment and live acceptance.
