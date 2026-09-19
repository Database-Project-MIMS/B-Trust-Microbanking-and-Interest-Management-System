# Notes for P1-T03: Seed Framework

## Step 1 Execution: The UUID Scheme
I created the `database/seed/_uuids.sql` file to act as the single source of truth for deterministic UUIDs across all our seed files. 

### What I Did
I defined a hardcoded, structured layout for our UUIDs: `00000000-0000-0000-XXYY-ZZZZZZZZZZZ0`.
- **XX**: Stands for the entity type (e.g., `01` for Branches, `02` for Roles, `03` for FD Plans).
- **YY**: Stands for the sequence identifier if we ever needed grouping, or just `01`.
- **ZZ...**: A numeric padding to maintain uniqueness per row.

Inside the SQL file, I mapped out the initial UUIDs for the core elements:
- The 3 branches (Colombo Main, Kandy City, Galle Fort)
- The 7 system roles (ADMIN, CENTRAL_OPS, BRANCH_MANAGER, AGENT, CUSTOMER, AUDITOR, SYSTEM)
- The 3 fixed deposit plans (6 Months, 1 Year, 3 Years)

### Why I Did It
The acceptance criteria and documentation (especially `docs/06_seed-data-spec.md`) strictly mandate that **seed data must be deterministic**. 
If we use Postgres' `gen_random_uuid()` to insert test data, the IDs change every time we re-seed the database. This makes it impossible for other members (who are working on foreign key-dependent tables like Customers or Agents) to reference the Branches or Roles since their IDs would constantly change. 

By fixing the UUIDs with an explicit, agreed-upon format, we ensure:
1. **Idempotency**: Running the seed scripts repeatedly produces the exact same state.
2. **Predictable Foreign Keys**: Other members can write their SQL seed files (like `03_agents.sql`) referencing `00000000-0000-0000-0101-000000000001` with the 100% guarantee that it points to the Colombo Main branch.

### What is a UUID?
A **UUID** (Universally Unique Identifier) is a 128-bit label used for information in computer systems. Standard UUIDs are formatted as 32 hexadecimal digits displayed in five groups separated by hyphens (e.g., `123e4567-e89b-12d3-a456-426614174000`).
Unlike sequentially auto-incrementing integer IDs (1, 2, 3), UUIDs are virtually guaranteed to be globally unique even when generated across different, disconnected systems without coordination. In modern databases and web applications, UUIDs are the preferred primary key type as they prevent malicious enumeration attacks (e.g., a user guessing `/api/users/2` to view someone else's data) and make data merging across distributed services seamless.

## Step 2 Execution: The Load Order
### What I Did
I created the `database/seed/_load-order.txt` file and explicitly listed the order in which the SQL seed files must be executed (e.g., `00_roles.sql`, then `01_branches.sql`, etc.).

### Why I Did It
In a relational database, tables have foreign key constraints. If we attempt to create a Customer before the Branch they belong to exists, the database will throw a referential integrity error and fail. By strictly defining the execution order in a text file, we guarantee that parent tables (like Branches and Roles) are always seeded before their dependent child tables (like Agents and Customers).

## Step 3 Execution: The Seed Script
### What I Did
I created a Node.js execution script at `scripts/seed.mjs` and updated our `package.json` so that the `npm run db:seed` command points to it.
This script reads the exact sequence of files from `_load-order.txt`, connects to PostgreSQL, starts a `BEGIN` transaction, loops through and executes each file sequentially, and finally runs `COMMIT`.

### Why I Did It
We cannot rely on the default migration runner or alphabetical execution for seed data because it doesn't enforce the strict dependencies required by our tables. Furthermore, wrapping the entire loop in a single `BEGIN` and `COMMIT` transaction ensures **atomicity**. If any single seed file fails (due to a constraint violation or typo), the entire database rolls back to its clean state (`ROLLBACK`). This prevents us from being stuck with half-seeded, corrupted data.
