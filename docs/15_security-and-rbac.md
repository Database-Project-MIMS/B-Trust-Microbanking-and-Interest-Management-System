# 15 — Security and RBAC

**Owner:** Member 1. Security is a boundary, and one person owning it keeps it coherent.

The governing idea: **the server authorizes every request, and the database enforces scope
even if the server has a bug.** Hiding a button is not access control (FR-AUTH-02).

---

## Roles

Seven implemented roles: six interactive roles plus internal SYSTEM; SRS user-class mapping remains G-09. One role per user (`app_user.role_id` — see gap **G-09**).
`AGENT` and `BRANCH_MANAGER` are different authorization roles but share the `agent`
branch-staff profile. The profile holds employment data and `branch_id`; `role_name`
determines which operations the authenticated user may perform.

| Role | Scope | Can do |
|---|---|---|
| `ADMIN` | Bank-wide | Users, roles, parameters, branches, deployment config |
| `CENTRAL_OPS` | Bank-wide | FD products, **interest runs**, bank-wide reports |
| `BRANCH_MANAGER` | Own branch | Branch agents, approve exceptions, joint mandates, **reversals**, branch reports |
| `AGENT` | Own branch, assigned customers | Register customers, open accounts, post deposits and withdrawals |
| `AUDITOR` | Bank-wide, **read-only** | Reports, ledger history, audit search |
| `CUSTOMER` | Own accounts only, when optional login is provisioned | View own linked accounts/balances/transactions; controlled own-holder withdrawal with self signer only (docs/05, 0627). No direct account UPDATE |
| `SYSTEM` | Internal controlled worker | Posting identity; QA uses existing roles with synthetic data |

## Permission matrix

[docs/19](19_implemented-api-matrix.md) is the independent role-by-handler contract.
The security suite compares it with every exported handler. ADMIN is not a universal
financial operator. Customer registration/account opening/deposits are staff operations;
reversals require BRANCH_MANAGER; FD opening requires AGENT, BRANCH_MANAGER or
CENTRAL_OPS. Product mutation is ADMIN-only.

## Branch scope

Branch-scoped roles (`BRANCH_MANAGER`, `AGENT`) see only their own branch's rows. Their
scope is resolved through `app_user.user_id = agent.agent_id`; `app_user` does not have a
`branch_id` column.

Session validation selects `agent.branch_id` with a join similar to:

```sql
SELECT u.user_id, r.role_name, a.branch_id
FROM app_user u
JOIN role r ON r.role_id = u.role_id
LEFT JOIN agent a ON a.agent_id = u.user_id
WHERE u.user_id = $1;
```

For `AGENT` and `BRANCH_MANAGER`, a missing `agent` row or missing branch is an
authorization failure (`403`). It must never become `branchId = null`, because `null` is
reserved for explicitly bank-wide roles. Customers are scoped through their own accounts,
not through the `agent` profile.

**The scope predicate goes in the SQL `WHERE` clause.** Fetching rows and then filtering
them in JavaScript means the rows already left the database — that is a leak waiting for
the next bug.

```ts
// wrong
const all = await query("SELECT ... FROM account");
return all.filter(a => a.branch_id === user.branchId);

// right
return query(
  "SELECT ... FROM account WHERE ($1::uuid IS NULL OR branch_id = $1)",
  [scope.branchId],
);
```

`branchScope()` returns `{ branchId: uuid | null }` — `null` only for bank-wide roles,
which the `IS NULL` guard turns into "no restriction". It returns a UUID for `AGENT` and
`BRANCH_MANAGER` and throws `403` if their required profile is missing.

## Row Level Security

RLS on `customer`, `account` and `transaction` (NFR-SEC-07) is the backstop: it holds even
when the application layer is wrong.

- The service sets `SET LOCAL app.current_user_id` and `app.current_branch_id` at the start
  of the transaction.
- Policies restrict rows to the caller's branch, or to accounts the caller holds (via
  `account_holder`) for `CUSTOMER`.
- `P06-M01-T03` verifies the policies by connecting **directly** as `mims_app` and
  attempting a cross-branch read, bypassing the application entirely.

## Database privilege model

| Role | Grants |
|---|---|
| `mims_owner` | Owns the schema. Used by migrations, seeds and isolated verification tooling; never the application runtime connection. |
| `mims_app` | `SELECT`, `INSERT`, `UPDATE` on operational tables. **No `UPDATE` or `DELETE` on `transaction`. No `DELETE` on `audit_log`. No `DROP`, no `CREATE`.** |

Posting cores are SECURITY INVOKER. The sole customer posting wrapper in 0627 is
pinned-path SECURITY DEFINER: stored active CUSTOMER/context/profile and exactly self
signer are checked, ownership is verified, then the existing locked audited withdrawal
core runs. Direct customer account UPDATE remains denied by RLS. `mims_app` retains RLS-constrained ledger INSERT,
with no UPDATE/DELETE. Immutability triggers additionally reject owner edits. Narrow
SECURITY DEFINER report/activity functions expose aggregates only with actor/scope checks.


AUDITOR is an application role using the RLS context on `mims_app`; no separate
`mims_readonly` database role is provisioned by the current rebuild. FD UPDATE grants
are limited to lifecycle columns; principal and opening-rate snapshots cannot be updated
by the runtime role.

## Passwords

argon2id (or bcrypt cost ≥ 12), per-user salt, never plaintext, never reversible, never
logged. `password_hash` is never selected into a DTO and never returned by any endpoint.

Sign-in failures return **one** generic message whether the username exists or not, and are
throttled via `login_attempt` (FR-AUTH-03) — otherwise the error message becomes a username
oracle.

## Sessions

- A server-side `user_session` row; the cookie carries only an opaque token.
- Only the token **hash** is stored, so reading the database does not let you impersonate a
  user.
- Session resolution joins `app_user` to `role` and `agent`; it returns
  `agent.branch_id` for `AGENT` and `BRANCH_MANAGER`, never a nonexistent
  `app_user.branch_id`.
- Cookie: `Secure`, `HttpOnly`, `SameSite=Lax`.
- Idle timeout 20 minutes, absolute timeout 8 hours, both checked in the database.
- Sign-out and password reset set `revoked_at`, which makes invalidation immediate and real
  (FR-AUTH-04).

## Phase 1 verified boundaries — 2026-10-05

`validateSession()` refreshes the inactivity deadline in SQL, capped by the configured
absolute timeout. Expired/revoked sessions and inactive users/roles/profiles are denied.
Session creation runs on the authentication service's transaction executor; the browser
cookie uses the absolute deadline so it can outlive a refreshed inactivity window.

Login requires JSON and rejects a supplied cross-origin `Origin`; authenticated mutations
require matching 64-character hexadecimal CSRF cookie/header tokens. Login returns
`branchId`; real request/SQL tests prove cross-branch denials. Health validates
`mims_session`, returns basic status to authenticated roles and restricts infrastructure
details/page to ADMIN/CENTRAL_OPS. Parameter APIs and page are ADMIN-only, with
validated, CSRF-protected, locked and audited edits. Pages authorize before loading data.

RLS remains Phase 2 work; Phase 1 SQL branch-scope tests do not claim RLS is delivered.

## SQL injection defence

Two rules, and they are absolute:

1. **Every value is a bound parameter.** `$1, $2, …`. No string concatenation, no template
   interpolation of user input, ever.
2. **Every dynamic identifier comes from a server-side allow-list.** Identifiers cannot be
   parameterized, so `allowListed(req.sort, ["posted_at","amount"], "posted_at")` is the
   only permitted route.

Tested in `P06-M01-T01` against every endpoint with real payloads (see
`12_testing-and-acceptance.md`).

## Input validation and CSRF

Server-side schemas in `lib/validation` run on every request; client validation is for
usability and is never trusted. All state-changing routes require a CSRF token
(NFR-SEC-04). Output is escaped on render; `narration` and name fields are stored as text
and never rendered as HTML.

## Audit

Every security-sensitive and financial action writes to `audit_log`: actor (nullable for
system actions), action, entity type and id, timestamp, IP, result and safe before/after
values as `jsonb`.

- Append-only — a trigger rejects `UPDATE`/`DELETE`, and `mims_app` has no `DELETE` grant.
- Sensitive values (identity numbers, hashes) are **masked before** being written
  (NFR-SEC-05).
- Report access is audited too (REP-COM-06).

## Secrets

Environment variables only. `.env` is gitignored; `.env.example` holds no real values.
Separate secrets per environment. **No `NEXT_PUBLIC_*` variable may ever contain a
credential** — that prefix ships to the browser.

### Production deployment boundary (P06-M01-T04)

`npm run verify:deployment` validates the **runtime** environment before start: an
HTTPS public `APP_BASE_URL`, `mims_app` in `DATABASE_URL`, non-placeholder session,
CSRF and interest-worker secrets, no owner migration URL in the app process, and no
credential-like `NEXT_PUBLIC_*` variable. It reports variable names, not values.
The owner URL belongs only in a separate migration job. The sample `.env.example`
is for local setup and must never be deployed unchanged.

Production TLS is terminated at a trusted reverse proxy/load balancer, which must
redirect HTTP to HTTPS. The Next.js app sends `Strict-Transport-Security` only in
production, plus frame, MIME-sniffing, referrer and browser-permission headers.
No hosting provider or certificate is provisioned by this repository; deployment
must verify the live HTTPS URL and response headers before claiming completion.

## Logging

Structured logs with redaction. Never log: passwords or hashes, session tokens, full
identity numbers, connection strings, or raw SQL containing user values. Client errors
carry a correlation id; the detail stays server-side (NFR-SEC-05).

## Checklist before any PR merges

- [ ] Every new endpoint calls `requireRole()` **and** applies branch scope in SQL
- [ ] Every query is parameterized; identifiers allow-listed
- [ ] No secret in client-reachable code or a `NEXT_PUBLIC_` variable
- [ ] Sensitive fields excluded from responses and logs
- [ ] Financial or security-sensitive actions write an audit event
- [ ] Negative authorization tests exist for the new route

## Local P06 evidence — ADR-0026

0621 enables transaction RLS alongside customer/account policies. Ledger visibility follows
account scope, including unattributed legacy rows. 0624 preserves agent-self history using
an execute-only aggregate with stored-actor/target/date checks. Direct runtime login tests
prove non-owner/non-superuser/non-BYPASSRLS behavior, unset-scope denial, customer held
accounts, branch isolation and denied ledger mutation/policy disabling. Endpoint tests cover
all seven roles and eight injection payloads at declared input positions. Valid-operation
suites separately prove successful processing. This does not claim protection against
stolen database credentials. Live HTTPS verification remains pending by user instruction.

0626 closes G-27: manager-only stored-actor validation and explicit owning-branch predicate
in the reversal routine, role gates in route/service, and scoped reversal-link RLS. ADMIN
is denied, including direct SQL. The guarded old signature remains for owner test/seed
compatibility. Real API tests prove key replay and actual receipt UUIDs.

## Predeployment capabilities — ADR-0027 / 2026-10-10

Transfers are staff-only; route and stored actor/branch/source-assignment checks agree.
Customer account UPDATE remains denied. Document verification and reset controls are
execute-only guarded capabilities; neither creates a broad table UPDATE grant.
Admin user/profile changes run atomically, reject disabling assigned agents or self access,
revoke sessions and invalidate reset tokens. The last active administrator is protected by
an advisory-serialized database trigger. Reset hashes/expiry/use are stored, raw token is
returned only to the issuer once, private fragment link is removed on capture, and consume
locks user then token before password update/session revocation. No email sender exists.
Unknown SQL errors are mapped to generic client errors, never arbitrary raised text.
All new state-changing routes enforce CSRF; public reset additionally requires its token.
Production dependency audit is zero; unresolved build-tool and live HTTPS limits are docs/21.

## CSP audit correction — ADR-0031 / 2026-10-10 (local)

`middleware.ts` enforces a fresh nonce CSP and overwrites caller-supplied CSP/nonce
headers before Next.js rendering. The root layout waits for `connection()` so all HTML,
including sign-in, is dynamic and bootstrap scripts receive the response nonce. Production
script-src omits unsafe-inline and unsafe-eval; strict-dynamic propagates trust to bundled
chunks. Existing inline React/GSAP styles are allowed by style-src only. Same-origin
connect/form/base directives, object-src none and frame-ancestors none apply alongside
the existing security headers. Development alone allows eval/WebSockets for HMR.
Static Next assets/image optimization/favicon bypass middleware. Changes await deployment;
the 2026-10-10 live audit's missing-CSP observation remains historical evidence.
