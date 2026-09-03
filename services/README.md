# services/

Business orchestration. Services own transaction boundaries and are the only
caller of `lib/db`. Route handlers call services; services never import from `app/`.

One file per domain area, e.g. `transaction-service.ts`, `account-service.ts`.

_Empty until Phase 1._
