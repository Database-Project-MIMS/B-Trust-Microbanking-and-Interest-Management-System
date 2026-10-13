# ADR-0035 — Shared password validation

Date: 2026-10-13. Status: accepted for scoped local implementation at user request.
Task: P06-M02-T05 (M2 contribution to M1 password-management flows).

Passwords being created or changed require 8–128 characters, an ASCII uppercase
letter, ASCII lowercase letter, digit and a symbol (a character other than a Unicode
letter, number or whitespace). This replaces length-only minimum-12 validation.
The user explicitly clarified the minimum to 8. Do not trim or normalize passwords.

Use a shared browser-safe policy, Zod server schema and existing native form/input
styles. Reuse the policy across agent creation, optional customer login provisioning,
admin password updates and reset consumption, for all roles on those shared paths.
Sign-in verifies stored hashes without applying the new creation policy.

No SQL migration or plaintext-password constraint: only hashes reach PostgreSQL;
complexity is a server policy under docs/07. Existing hashing, authorization, CSRF,
transaction boundaries, reset control and session revocation remain in force.
Original M1/M2/lead stewardship is retained; the cross-owner receipt is
[the handoff](../handoffs/p06-password-validation.md). The user subsequently authorizes
a few local commits. No push/PR/merge/deploy.
