# ADR-0003: Money as NUMERIC, rates as fractions

**Date:** Phase 0 · **Status:** Accepted

## Decision

All monetary columns are `NUMERIC(15,2)` via the `money_amount` / `positive_money`
domains defined in migration `0000`. Interest rates are `NUMERIC(6,4)` stored as
fractions (`0.1400`, not `14`) via the `interest_rate` domain, constrained
`0 ≤ value ≤ 1`. Money crosses the API as a **string**, never a JSON number, and is never
parsed into a JavaScript number for arithmetic — all monetary arithmetic happens in SQL
or PL/pgSQL.

## Why

`float`/`double` cannot represent currency exactly (0.1 + 0.2 ≠ 0.3 in IEEE 754), and this
is a banking system where the interest formula
(`principal × rate × 30 / 365`, rounded to 2dp) must be exact and reproducible. A
domain-level constraint also catches the easy mistake of entering a rate as `14` instead
of `0.14` at insert time rather than in review.

## What it rules out

- Any `float`/`double`/`real` column touching money or rates
- Client-side calculation of any balance, interest amount, or running total
- JSON numeric serialization of money (must be a quoted string)

## Consequence

`scripts/verify-setup.mjs` includes an explicit check that no money column uses a
floating-point type, and this check is part of `npm run db:verify`.
