# 15 — Security and RBAC

**Owner:** Member 1. Security is a boundary, and one person owning it keeps it coherent.

The governing idea: **the server authorizes every request, and the database enforces scope
even if the server has a bug.** Hiding a button is not access control (FR-AUTH-02).

---

## Roles

Seven roles, matching SRS §2.4. One role per user (`app_user.role_id` — see gap **G-09**).

| Role | Scope | Can do |
|---|---|---|
| `ADMIN` | Bank-wide | Users, roles, parameters, branches, deployment config |
| `CENTRAL_OPS` | Bank-wide | FD products, **interest runs**, bank-wide reports |
| `BRANCH_MANAGER` | Own branch | Branch agents, approve exceptions, joint mandates, **reversals**, branch reports |
| `AGENT` | Own branch, assigned customers | Register customers, open accounts, post deposits and withdrawals |
| `AUDITOR` | Bank-wide, **read-only** | Reports, ledger history, audit search |
| `CUSTOMER` | Own accounts only | View own accounts, balances, transactions (scope subject to **OQ-05**) |
| `QA_TESTER` | Configurable | Exercise workflows against synthetic data |

## Permission matrix

| Operation | ADMIN | CENTRAL_OPS | BRANCH_MGR | AGENT | AUDITOR | CUSTOMER |
|---|:--:|:--:|:--:|:--:|:--:|:--:|
| Sign in | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Manage users and roles | ✅ | — | — | — | — | — |
| Manage system parameters | ✅ | — | — | — | — | — |
| Manage branches | ✅ | — | — | — | — | — |
| Manage agents | ✅ | — | own branch | — | — | — |
| Register customers | ✅ | — | own branch | own branch | — | — |
| View customers | ✅ | ✅ | own branch | assigned | ✅ read | self |
| Open savings account | ✅ | — | own branch | own branch | — | — |
| Close account | ✅ | — | own branch | — | — | — |
| Post deposit | ✅ | — | own branch | own branch | — | — |
| Post withdrawal | ✅ | — | own branch | own branch | — | own, if holder |
| **Reverse a transaction** | ✅ | — | **own branch** | ❌ | — | ❌ |
| Manage FD products | ✅ | ✅ | — | — | — | — |
| Open fixed deposit | ✅ | ✅ | own branch | own branch | — | — |
| **Run interest cycle** | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Run reports | ✅ | ✅ | own branch | ❌ | ✅ | ❌ |
| Search audit log | ✅ | — | — | — | ✅ | — |

`—` not applicable · `❌` explicitly denied and tested.

## Branch scope

Branch-scoped roles (`BRANCH_MANAGER`, `AGENT`) see only their own branch's rows.

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

`branchScope()` returns `{ branchId: uuid | null }` — `null` for bank-wide roles, which the
`IS NULL` guard turns into "no restriction".

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
| `mims_owner` | Owns the schema. Used **only** by migrations. Never in `DATABASE_URL`. |
| `mims_app` | `SELECT`, `INSERT`, `UPDATE` on operational tables. **No `UPDATE` or `DELETE` on `transaction`. No `DELETE` on `audit_log`. No `DROP`, no `CREATE`.** |
| `mims_readonly` | `SELECT` only — auditors and reporting |

`mims_app` writes ledger rows only through the posting routines, which run
`SECURITY DEFINER` where a targeted extra privilege is genuinely required. This is what
makes "posted transactions are immutable" true at the database level rather than by
convention (FR-TXN-02, BR-16).

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
- Cookie: `Secure`, `HttpOnly`, `SameSite=Lax`.
- Idle timeout 20 minutes, absolute timeout 8 hours, both checked in the database.
- Sign-out and password reset set `revoked_at`, which makes invalidation immediate and real
  (FR-AUTH-04).

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
