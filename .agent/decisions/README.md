# Architecture Decision Records

Short records of decisions that are expensive to reverse, or that constrain more than one
member. Not every choice needs one — routine implementation details don't. A decision
earns an ADR when it changes the schema shape, a cross-member contract, or something a
future session would otherwise silently re-litigate.

## Format

```
# ADR-NNNN: Title

Date, status (proposed/accepted/superseded), the decision, why, what it rules out.
```

## Index

| ID | Title | Status |
|---|---|---|
| ADR-0001 | PostgreSQL 16 with node-postgres, no ORM | Accepted |
| ADR-0002 | Vertical-slice work division, not layers | Accepted |
| ADR-0003 | Money as NUMERIC, rates as fractions | Accepted |
| ADR-0004 | current_balance as a maintained denormalisation | Accepted |
| ADR-0005 | Reserved per-member migration number blocks | Accepted |
| ADR-0006 | Branch managers share the agent branch-staff profile | Accepted |
