import pg from "pg";

/** Creates a dedicated tooling connection; never used by browser or route code. */
export function createMigrationClient(connectionString) {
  return new pg.Client({ connectionString, connectionTimeoutMillis: 5000 });
}
