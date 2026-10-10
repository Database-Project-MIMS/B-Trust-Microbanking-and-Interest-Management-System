# P06-M01-T04 — deployment security draft

Scoped early start at the user's direction; general Phase 6 entry is not approved.
Branch: `feat/p06-m01-deployment`, based on local `dev` 939ee87. No assistant
commit, push, PR or deployment.

Changed `.env.example` to remove a credential-like example value; documented
separate owner migration and application runtime environments. `next.config.ts`
adds production-only HSTS and a restrictive browser Permissions-Policy to the
existing frame, MIME and referrer headers. `scripts/check-deployment-security.mjs`
rejects non-HTTPS/loopback public origins, runtime owner credentials, weak or
placeholder secrets and credential-like `NEXT_PUBLIC_*` values without printing
their contents. `npm run verify:deployment` runs that check. The disposable test
runner includes `tests/security/`; `npm run test:security` is available.

Verification: security tests 6/6, clean 41-migration disposable rebuild,
typecheck (`--incremental false`), lint and production build pass. The build
used a synthetic non-connecting application URL. The full combined suite is
733/761 pass, 28 failures outside these six tests; therefore this task is not
marked DONE. A live HTTPS response, certificate, redirect and header check
cannot be claimed without an approved deployment target. If the removed example
value was ever used as a real password, its owner must rotate it; deleting it
from the current file does not erase Git history.
