# ADR-0028 — Local Docker container setup

2026-10-10 · user-authorized infrastructure contribution by M2.

The user requested another branch and Dockerization, a commit message, no push
and no PR. Branch `feat/p06-m02-dockerize` starts at existing verified HEAD
`8a2b9c2`; no pull/merge or rewriting of that baseline is needed. The user's
follow-up authorizes a few local commits. Commit the infrastructure, tests and
documentation separately; push, PR creation and merge remain prohibited.

Blueprint: Linux Node 22 slim multi-stage app/tooling images, PostgreSQL 16 with
a private network and persistent volume, separate owner-only setup, non-root
standalone web runtime and localhost-only HTTP demo access. No schema migration,
financial rule, endpoint or UI change. SQL comes from the existing canonical
ordered stages. Setup seeds only a fresh user table and never drops/resets data.

The request authorizes the concrete container implementation and necessary
shared configuration/documentation contribution. Stewardship stays unchanged;
handoff records affected paths. Local Docker verification does not approve a
general phase gate or complete M1's live HTTPS deployment task.

Instructions: `docs/22_docker-setup.md`. Verification and limitations are recorded
in `.agent/handoffs/p06-m02-docker-setup.md` after checks.
