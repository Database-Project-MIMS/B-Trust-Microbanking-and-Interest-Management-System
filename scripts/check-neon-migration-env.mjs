import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

/** Validate a deployment connection without returning or logging credential values. */
export function validateNeonMigrationUrl(value) {
  if (!value) throw new Error("Set the DATABASE_MIGRATION_URL secret in the selected GitHub environment.");
  let target;
  try { target = new URL(value); }
  catch { throw new Error("DATABASE_MIGRATION_URL must be a valid PostgreSQL URL."); }
  if (!["postgres:", "postgresql:"].includes(target.protocol)
    || !target.hostname.endsWith(".neon.tech") || !target.pathname.slice(1)
    || !target.password || target.hash) {
    throw new Error("DATABASE_MIGRATION_URL must target a Neon database with credentials.");
  }
  if (target.hostname.split(".")[0].endsWith("-pooler")) {
    throw new Error("Use the direct Neon connection with connection pooling disabled for migrations.");
  }
  if (target.username !== "mims_owner") {
    throw new Error("Migrations require the mims_owner role; keep the mims_app connection in the application only.");
  }
  if (target.searchParams.getAll("sslmode").length !== 1
    || !["require", "verify-ca", "verify-full"].includes(target.searchParams.get("sslmode"))) {
    throw new Error("The Neon migration connection must require TLS using sslmode.");
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    validateNeonMigrationUrl(process.env.DATABASE_MIGRATION_URL);
    console.log("Neon migration connection configuration is valid.");
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
