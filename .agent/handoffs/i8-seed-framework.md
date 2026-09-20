# Integration Point I-8: Seed Framework

## How to add seed data for your tables

1. Create a file in `database/seed/` with the correct number prefix
2. Use fixed UUIDs from `_uuids.sql` — NEVER gen_random_uuid()
3. Follow the FK load order (your file depends on parent tables)
4. Submit your seed file — M5 integrates it into the load order
5. Run `npm run db:seed && npm run db:seed-check` to verify

## UUID scheme
See `database/seed/_uuids.sql` for the pattern.

## Minimum row counts
See the table in this handoff and AC-12.
