import { spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join, resolve, sep } from "node:path";
import { createMigrationClient } from "../lib/db/migration-client.mjs";

// A disposable cluster gives the rebuild proof no access to the developer's database.
const workspace = mkdtempSync(join(tmpdir(), "mims-closeout-"));
const data = join(workspace, "pgdata");
const passwordFile = join(workspace, "init-password");
const password = randomBytes(24).toString("hex");
const pgBin = process.env.PG_BIN ?? ["18", "17", "16", "15"]
  .map(version => `C:/Program Files/PostgreSQL/${version}/bin`)
  .find(path => existsSync(join(path, "initdb.exe")));
let started = false;

function binary(name) { return pgBin ? join(pgBin, process.platform === "win32" ? `${name}.exe` : name) : name; }
function command(executable, args, env, quiet = false) {
  // Detached PostgreSQL children must not inherit a pipe that keeps spawnSync open.
  const control = executable.endsWith("pg_ctl.exe") || executable.endsWith("/pg_ctl");
  const result = spawnSync(executable, args, { env, encoding: "utf8", windowsHide: true, stdio: control ? "ignore" : quiet ? "pipe" : "inherit", timeout: control ? 30000 : undefined });
  if (result.status !== 0) {
    const diagnostic = quiet ? `${result.stdout ?? ""}\n${result.stderr ?? ""}`.split(password).join("[REDACTED]") : "";
    throw new Error(`Verification command failed: ${executable.split(/[\\/]/).pop()} ${diagnostic}`);
  }
}
const port = await new Promise((accept, reject) => {
  const server = createServer();
  server.on("error", reject);
  server.listen(0, "127.0.0.1", () => {
    const address = server.address();
    const number = address.port;
    server.close(() => accept(number));
  });
});
function connection(role, database = "mims_test_closeout") {
  return `postgresql://${role}:${password}@127.0.0.1:${port}/${database}`;
}
const env = {
  ...process.env,
  DATABASE_URL: connection("mims_app"),
  DATABASE_MIGRATION_URL: connection("mims_owner"),
  MIMS_ISOLATED_TEST: "1",
  PGPOOL_IDLE_TIMEOUT_MS: "100",
};

try {
  writeFileSync(passwordFile, password, { mode: 0o600 });
  command(binary("initdb"), ["-D", data, "-U", "mims_test_admin", "-A", "scram-sha-256", "--pwfile", passwordFile, "--encoding=UTF8", "--locale=C"], process.env, true);
  rmSync(passwordFile);
  command(binary("pg_ctl"), ["-D", data, "-l", join(workspace, "postgres.log"), "-o", `-p ${port} -h 127.0.0.1 -k ${workspace}`, "-w", "start"], process.env, true);
  started = true;
  const admin = createMigrationClient(connection("mims_test_admin", "postgres"));
  await admin.connect();
  try {
    for (const role of ["mims_owner", "mims_app"]) {
      const { rows } = await admin.query("SELECT format('CREATE ROLE %I LOGIN PASSWORD %L', $1::text, $2::text) AS ddl", [role, password]);
      await admin.query(rows[0].ddl);
    }
    await admin.query("ALTER ROLE mims_owner CREATEDB");
    // Disposable-only membership enables least-privilege SET ROLE service regressions.
    // The application role never inherits owner privileges.
    await admin.query("GRANT mims_app TO mims_owner");
    await admin.query("CREATE DATABASE mims_test_closeout OWNER mims_owner");
  } finally { await admin.end(); }

  console.log("Isolated PostgreSQL cluster ready. Existing mims_dev is preserved.");
  command(process.execPath, ["scripts/db-rebuild.mjs"], env);
  const requestedSuite = process.argv.find(arg => arg.startsWith("--suite="))?.slice(8);
  if (requestedSuite && !["api", "db", "e2e", "security"].includes(requestedSuite)) throw new Error("Unknown test suite.");
  const tests = (requestedSuite ? [requestedSuite] : ["api", "db", "e2e", "security"]).flatMap(folder =>
    readdirSync(join("tests", folder)).filter(file => file.endsWith(".test.mjs")).map(file => join("tests", folder, file)));
  command(process.execPath, ["node_modules/tsx/dist/cli.mjs", "--conditions", "react-server", "--test", "--test-concurrency=1", ...tests], env);
  if (!process.argv.includes("--tests-only")) {
    command(process.execPath, ["node_modules/typescript/bin/tsc", "--noEmit"], env);
    command(process.execPath, ["node_modules/eslint/bin/eslint.js", "."], env);
    command(process.execPath, ["node_modules/next/dist/bin/next", "build"], env);
  }
  console.log(process.argv.includes("--tests-only") ? "ISOLATED TESTS: all checks passed." : "PHASE 1 CLOSEOUT: all checks passed.");
} catch (error) {
  console.error(error.message);
  if (!started && existsSync(join(workspace, "postgres.log"))) console.error(readFileSync(join(workspace, "postgres.log"), "utf8").split(password).join("[REDACTED]"));
  process.exitCode = 1;
} finally {
  if (started && existsSync(join(data, "postmaster.pid"))) command(binary("pg_ctl"), ["-D", data, "-m", "fast", "-w", "stop"], process.env, true);
  // Verify the exact generated absolute path before any recursive cleanup.
  const absolute = resolve(workspace);
  if (!absolute.startsWith(resolve(tmpdir()) + sep) || !absolute.split(/[\\/]/).pop().startsWith("mims-closeout-")) {
    throw new Error("Refusing cleanup outside the generated temporary workspace.");
  }
  rmSync(absolute, { recursive: true, force: true });
}
