import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { checkNeonAppEnvironment } from "../../scripts/check-neon-app-env.mjs";

const fixture = "postgresql://mims_app:synthetic-password@ep-example-pooler.us-east-2.aws.neon.tech/mims_staging?sslmode=require";
const env = { ...process.env, NODE_ENV: "production", NEON_DATABASE_URL: fixture,
  DATABASE_URL: fixture, SESSION_SECRET: "a".repeat(64), CSRF_SECRET: "b".repeat(64),
  INTEREST_WORKER_TOKEN: "c".repeat(64), APP_BASE_URL: "http://localhost:3001", MIMS_NEON_HTTP_PORT: "3001" };
for (const name of ["DATABASE_MIGRATION_URL", "MIMS_OWNER_PASSWORD", "MIMS_POSTGRES_PASSWORD", "POSTGRES_PASSWORD"]) delete env[name];
const config = overrides => spawnSync("docker", ["compose", "-f", "compose.neon.yaml", "--env-file", ".env.neon.example",
  "config", "--format", "json"], { env: { ...env, ...overrides }, encoding: "utf8", windowsHide: true, timeout: 30000 });

test("Neon Compose starts only the app and excludes owner credentials even when the host has them", () => {
  const result = config({ DATABASE_MIGRATION_URL: fixture.replace("mims_app:", "mims_owner:"),
    MIMS_OWNER_PASSWORD: "owner-fixture", MIMS_POSTGRES_PASSWORD: "admin-fixture" });
  assert.equal(result.status, 0, result.stderr);
  const parsed = JSON.parse(result.stdout);
  assert.equal(parsed.name, "mims-neon");
  assert.deepEqual(Object.keys(parsed.services), ["app"]);
  assert.equal(parsed.volumes, undefined);
  const app = parsed.services.app;
  assert.equal(app.build.target, "runner");
  assert.equal(app.environment.DATABASE_URL, fixture);
  assert.equal(app.depends_on, undefined);
  assert.equal(app.ports[0].host_ip, "127.0.0.1");
  assert.equal(app.ports[0].published, "3001");
  assert.match(app.command.join(" "), /check-neon-app-env\.mjs && exec node server\.js/);
  for (const name of ["DATABASE_MIGRATION_URL", "MIMS_OWNER_PASSWORD", "MIMS_POSTGRES_PASSWORD", "POSTGRES_PASSWORD", "MIMS_SEED_DEMO"]) {
    assert.equal(app.environment[name], undefined, `${name} must not reach the app`);
  }
  assert.deepEqual(checkNeonAppEnvironment(app.environment), []);
});

test("Neon Compose rejects an absent dedicated URL instead of using the host DATABASE_URL", () => {
  const result = config({ NEON_DATABASE_URL: "" });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /NEON_DATABASE_URL/);
});

test("Neon runtime accepts restricted direct or pooled TLS connections and local or public HTTPS origins", () => {
  for (const host of [fixture, fixture.replace("-pooler", "")]) {
    for (const origin of ["http://localhost:3001", "http://127.0.0.1:3001", "https://mims.example.com"]) {
      assert.deepEqual(checkNeonAppEnvironment({ ...env, DATABASE_URL: host, APP_BASE_URL: origin }), []);
    }
  }
});

test("Neon runtime rejects elevated roles, missing secrets, unsafe origins and disabled TLS", () => {
  for (const override of [
    { DATABASE_URL: fixture.replace("mims_app:", "mims_owner:") },
    { DATABASE_URL: fixture.replace("mims_app:", "neondb_owner:") },
    { DATABASE_URL: "invalid-url" },
    { DATABASE_URL: fixture.replace(".neon.tech", ".neon.tech.attacker.example") },
    { DATABASE_URL: fixture.replace(":synthetic-password", ":") },
    { DATABASE_URL: fixture.replace("/mims_staging?", "/?") },
    { DATABASE_URL: fixture.replace("sslmode=require", "sslmode=disable") },
    { DATABASE_URL: fixture.replace("?sslmode=require", "") },
    { DATABASE_URL: fixture + "&sslmode=disable" },
    { DATABASE_MIGRATION_URL: fixture }, { MIMS_OWNER_PASSWORD: "synthetic-owner" },
    { SESSION_SECRET: "" }, { CSRF_SECRET: "CHANGE_ME".repeat(8) },
    { INTEREST_WORKER_TOKEN: "short" }, { NODE_ENV: "development" },
    { APP_BASE_URL: "http://mims.example.com" },
    { APP_BASE_URL: "http://user:password@localhost:3001" },
    { APP_BASE_URL: "https://mims.example.com/path" },
  ]) {
    assert.ok(checkNeonAppEnvironment({ ...env, ...override }).length > 0);
  }
});

test("runtime startup diagnostics never print credentials", () => {
  const result = spawnSync(process.execPath, ["scripts/check-neon-app-env.mjs"], {
    env: { ...env, DATABASE_URL: fixture.replace("mims_app:", "mims_owner:") }, encoding: "utf8", windowsHide: true,
  });
  assert.equal(result.status, 1);
  assert.doesNotMatch(result.stdout + result.stderr, /synthetic-password|ep-example/);
});
