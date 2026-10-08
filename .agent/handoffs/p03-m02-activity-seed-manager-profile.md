# Browser verification finding — seeded manager profiles

**Date:** 2026-10-08 · **Raised by:** M2 · **To:** M5 seed steward, M1 authentication owner

While verifying P03-M02-T02 after a clean rebuild, `bm_colombo` successfully logs
in but returns to sign-in. `02_users.sql` creates three BRANCH_MANAGER logins;
`03_agents.sql` supplies only the six ordinary AGENT profiles. ADR-0006 and session
validation require an active branch-staff `agent` profile for branch managers too.
The security gate correctly fails closed; no authentication code change is needed.

Please add deterministic synthetic manager profiles for Colombo/Kandy/Galle in
the steward-owned seed and assert required staff profiles in seed verification.
No seed files or another member's status have been changed by T02. API regressions
already create valid manager profiles. Browser QA uses an additional synthetic
manager profile only in its disposable fixture; the normal database stays intact.
