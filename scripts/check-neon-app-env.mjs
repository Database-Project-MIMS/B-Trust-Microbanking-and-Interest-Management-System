import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

/** Validate the Docker Neon runtime configuration without exposing credential values. */
export function checkNeonAppEnvironment(env) {
  const problems = [];
  if (env.NODE_ENV !== "production") problems.push("NODE_ENV must be production.");
  let target;
  try { target = new URL(env.DATABASE_URL ?? ""); }
  catch { problems.push("DATABASE_URL must be a valid Neon PostgreSQL URL."); }
  if (target) {
    if (!["postgres:", "postgresql:"].includes(target.protocol)
      || !target.hostname.endsWith(".neon.tech") || !target.pathname.slice(1)
      || target.username !== "mims_app" || !target.password || target.hash) {
      problems.push("DATABASE_URL must use the restricted mims_app role on a Neon database.");
    }
    if (target.searchParams.getAll("sslmode").length !== 1
      || !["require", "verify-ca", "verify-full"].includes(target.searchParams.get("sslmode"))) {
      problems.push("The Neon runtime connection must require TLS using sslmode.");
    }
  }
  for (const name of ["DATABASE_MIGRATION_URL", "MIMS_OWNER_PASSWORD", "MIMS_POSTGRES_PASSWORD", "POSTGRES_PASSWORD"]) {
    if (env[name]) problems.push(`${name} must not be present in the app runtime.`);
  }
  for (const name of ["SESSION_SECRET", "CSRF_SECRET", "INTEREST_WORKER_TOKEN"]) {
    if ((env[name] ?? "").length < 32 || /CHANGE_ME|REPLACE_WITH/i.test(env[name] ?? "")) {
      problems.push(`${name} must be a non-placeholder secret of at least 32 characters.`);
    }
  }
  let origin;
  try { origin = new URL(env.APP_BASE_URL ?? ""); }
  catch { problems.push("APP_BASE_URL must be a valid application origin."); }
  if (origin) {
    const local = ["localhost", "127.0.0.1", "[::1]"].includes(origin.hostname);
    if (!(origin.protocol === "https:" || (local && origin.protocol === "http:"))
      || origin.username || origin.password || origin.search || origin.hash || origin.pathname !== "/") {
      problems.push("APP_BASE_URL must be an HTTPS origin, or HTTP on localhost for local Docker access.");
    }
  }
  return problems;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const problems = checkNeonAppEnvironment(process.env);
  if (problems.length) {
    for (const problem of problems) console.error(problem);
    process.exitCode = 1;
  } else {
    console.log("Neon app runtime configuration is valid.");
  }
}
