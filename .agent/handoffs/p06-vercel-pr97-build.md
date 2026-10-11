# PR #97 — Vercel build correction

Date: 2026-10-11. Branch: `feat/p06-m02-live-audit-fixes`.
PR head at diagnosis: `5253f6d`. Vercel check failed; disposable PostgreSQL/application
CI passed. The user supplied the missing TypeScript log and requested repair.
Earlier cross-member edit authority applies; original stewardship is retained.

Cross-owner contribution: shared Next/Vercel build configuration, M1 deployment
security tests and member deployment guide. M2 updates deployment documentation,
task/state receipts and ADR-0032. No schema, migration, service, route, UI, permission,
financial logic or dependency-version changes. Migration numbers: none.

Blueprint/review benchmark: config must load without a TypeScript compiler; the
Vercel build must explicitly install the locked development toolchain even under
production/omit-dev settings. Security headers, CSP, dev output separation and
Docker standalone output must retain their behavior. Install scripts must not be
globally enabled as a workaround. Publish/redeploy through the user's existing PR.

Implemented `next.config.mjs` with JSDoc typing and `vercel.json` specifying
`npm ci --include=dev` and `npm run build`. The package manifest/lockfile already
declare TypeScript, so neither changes. Updated the existing security test import
and added a real Next loader regression in three fresh subprocesses denying any
TypeScript resolution. The M1 deployment guide points at the new config name.
`dev_files.txt` retains its original UTF-16 encoding with the config entry renamed.

Existing financial/frontend audit evidence remains historical; these changes do
not certify hosted Vercel deployment or remaining final-action acceptance.

## Verification and review

11 focused deployment/CSP tests in two suites pass without skips. The new loader
regression exercises production, development and Docker configuration with compiler
resolution blocked. Root typecheck, lint and diff checks pass.

A fresh tracked-source copy contains no ignored environment files or node_modules.
With both `NODE_ENV=production` and `npm_config_omit=dev`, `npm ci --include=dev`
installs 380 locked packages, including TypeScript 5.9.3, Tailwind 3.4.19,
autoprefixer 10.5.5, ESLint 9.39.5 and tsx 4.23.13. Argon2 hash/verify passes.
Next 15.5.27 production compilation, lint/type validity, route generation and traces
pass in that copy with a synthetic, unreachable database URL. No real DB is contacted.

The initial offline install lacked a cached archive; the approved network install
passed. The sandboxed build hit Windows output-directory EPERM. The final build
used the same installed source copy in a verified external temporary directory,
outside the sandbox and parent repository dependency resolution. These were local
verification environment issues; no code workarounds were introduced.

Production `next start` succeeds. Two anonymous /sign-in responses are HTTP 200,
with HSTS, enforced CSP, distinct nonces matching every script and no-store caching.
The server is stopped after the smoke check. Host: Node 24.15.0/npm 11.12.1 on Windows;
the pinned Node 22/Vercel Linux hosted rerun remains pending publication.
The temporary source/dependency/build copy and smoke harness were removed after verification.

/review: plan alignment, system integrity and local deployment behavior pass;
no unresolved local findings. /imprint is inapplicable because no UI changes.
All five overview summary tables were reviewed; no additional task is marked DONE.
P06-M01-T04 stays IN_PROGRESS pending hosted deployment/retest and existing acceptance
limits. Publication, redeployment and peer review remain user actions.
