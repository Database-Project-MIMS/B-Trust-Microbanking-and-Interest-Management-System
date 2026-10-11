# 24 — Vercel application build

The repository root contains `vercel.json`. Vercel uses the Next.js framework
preset, `npm ci --include=dev` for installation and `npm run build` for compilation.
These file-based commands override the project's dashboard install/build commands.
Use the repository root as the Vercel Root Directory and Node 22 as pinned in
`.nvmrc`. Leave the Output Directory at the framework default.

TypeScript, Tailwind, PostCSS, ESLint and type declarations are build dependencies.
They must be installed before compilation even when `NODE_ENV=production` or
`npm_config_omit=dev` is configured. Explicit `--include=dev` takes precedence over
omission. `npm ci` installs the committed lockfile and fails if it differs from the
manifest; do not install or upgrade packages inside the build command.

`next.config.mjs` loads directly in Node without requiring the TypeScript compiler.
Its JSDoc annotation provides editor types. React strict mode, external server
packages, separate development output, Docker standalone output and security headers
retain their previous behavior. The application still uses TypeScript and the build
still performs type checking. Nonce CSP remains enforced by middleware.

## PR #97 failure and recovery

The reported deployment attempted `npm install typescript && npm run build`, then
failed loading `next.config.ts` with `MODULE_NOT_FOUND: typescript`. TypeScript was
already declared and locked as a development dependency. The log is consistent with
development dependencies being omitted; the actual dashboard environment settings
have not been inspected. Installing TypeScript again without overriding omission
does not guarantee that the compiler reaches disk.

Publish the reviewed correction to PR #97's existing branch and trigger a new
deployment of that commit. The new log should show `npm ci --include=dev`, then
`npm run build`, and load `next.config.mjs`. Redeploying the old commit retains
its old commands/configuration. If the log still runs the old custom command,
check the selected commit and Root Directory.

The reported `allowScripts` warnings are separate from the missing compiler error.
No global script-policy override is introduced. Check any actual native-module
failure separately; local verification includes Argon2 hashing and verification.

Keep the restricted runtime `DATABASE_URL` and application security secrets in
Vercel's environment settings. Never provide the owner migration URL to the app.
Neon schema deployment uses the separate [migration workflow](23_neon-migrations.md).
A passing build does not run migrations, seed data or certify live application flows.

## Local verification — 2026-10-11

A clean source install with production/omit-dev settings, production build,
TypeScript/lint checks, Argon2 hash/verify and 11 focused deployment/CSP tests pass.
Next's actual config loader succeeds with compiler resolution blocked for production,
development and Docker settings. Production startup and two sign-in responses pass
with matching fresh script nonces, enforced CSP, HSTS and no-store. Verification used
synthetic settings and no live database. Local host: Windows/Node 24.15.0/npm 11.12.1;
the new Node 22/Vercel deployment is still pending publication.
Detailed [review receipt](../.agent/handoffs/p06-vercel-pr97-build.md).

## Customer branch / PR #98 — 2026-10-11

PR #97's `26b315e` deployment is now successful. PR #98's published `3e6a292`
branched from the older audit source and lacked the build correction; its application
CI passed but Vercel failed. The existing build and menu commits are now cherry-picked
locally onto `feat/p02-m02-customer-details` as `8e05feb` and `cc4147c`.
Publish these commits to PR #98 before retrying its deployment. Retrying `3e6a292`
still uses the old TS configuration and dashboard commands.
Combined local verification passes 3,418 tests /117 suites, clean rebuild/restore,
typecheck, lint and production build. Private Vercel logs were not inspected;
the new PR #98 hosted deployment remains pending publication.
[Combined verification receipt](../.agent/handoffs/p02-m02-customer-details.md).

## References

- [Vercel file-based build commands](https://vercel.com/docs/project-configuration/vercel-json#buildcommand)
- [Vercel file-based install command](https://vercel.com/docs/project-configuration/vercel-json#installcommand)
- [npm ci inclusion and omission](https://docs.npmjs.com/cli/v11/commands/npm-ci/#include)
- [Next.js configuration loading](https://nextjs.org/docs/messages/next-config-error)
