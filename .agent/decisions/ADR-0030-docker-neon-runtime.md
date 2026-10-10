# ADR-0030 — Docker application runtime connected to Neon

2026-10-10. User requested necessary Docker changes for the Neon deployment,
then offered passwords if needed. Existing branch `feat/p06-m02-neon-migrations`,
base `5e5dbb3`. The user subsequently authorized local commits; no push,
PR creation, merge or live connection performed.

Preserve the local PostgreSQL Compose stack and add a standalone app-only
`compose.neon.yaml` using the existing Node 22 runtime image. Its separate
`mims-neon` project and localhost port 3001 avoid sharing local services/volumes.
GitHub Actions owns migration deployment; the Neon app never runs setup or seeds.
An empty migrated database still requires deliberate reference/user provisioning.

Generate independent application secrets into ignored `.env.neon`, leaving
`NEON_DATABASE_URL` for the user to fill locally. Explicit Compose environment
mapping passes only app credentials/settings; no owner credentials are needed.
The runtime check requires `mims_app`, Neon TLS, production mode and strong app
secrets. Pooled and direct application connections are supported. Allow localhost
HTTP for demonstration; public origins require HTTPS and separately configured TLS.
Do not request or record password values in chat, docs, tests or build output.

No schema, migration, endpoint, financial rule or UI changes. Shared-file
stewardship and phase acceptance remain unchanged. All member overview tables
were reviewed; no newly accepted task changes a row/strikethrough.
Evidence and limitations: `../handoffs/p06-docker-neon-runtime.md`.
