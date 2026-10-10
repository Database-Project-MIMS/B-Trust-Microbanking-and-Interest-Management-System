import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";

const env = { ...process.env, MIMS_POSTGRES_PASSWORD: "a".repeat(64),
  MIMS_OWNER_PASSWORD: "b".repeat(64), MIMS_APP_PASSWORD: "c".repeat(64),
  SESSION_SECRET: "d".repeat(64), CSRF_SECRET: "e".repeat(64), INTEREST_WORKER_TOKEN: "f".repeat(64),
  MIMS_HTTP_PORT: "3000", APP_BASE_URL: "http://localhost:3000" };
const config = overrides => spawnSync("docker", ["compose", "--env-file", ".env.docker.example",
  "config", "--format", "json"], { env: { ...env, ...overrides }, encoding: "utf8", windowsHide: true, timeout: 30000 });

test("Compose enforces privilege separation, private database and readiness", () => {
  const result = config();
  assert.equal(result.status, 0, result.stderr);
  const { services, volumes } = JSON.parse(result.stdout);
  assert.equal(services.app.build.target, "runner");
  assert.equal(services.setup.build.target, "tooling");
  assert.match(services.app.environment.DATABASE_URL, /^postgresql:\/\/mims_app:/);
  assert.match(services.setup.environment.DATABASE_MIGRATION_URL, /^postgresql:\/\/mims_owner:/);
  for (const name of ["DATABASE_MIGRATION_URL", "MIMS_OWNER_PASSWORD", "MIMS_POSTGRES_PASSWORD", "POSTGRES_PASSWORD"]) {
    assert.equal(services.app.environment[name], undefined, `${name} must not reach the application`);
  }
  assert.equal(services.db.ports, undefined);
  assert.equal(services.app.ports[0].host_ip, "127.0.0.1");
  assert.equal(services.app.depends_on.setup.condition, "service_completed_successfully");
  assert.equal(services.setup.depends_on.db.condition, "service_healthy");
  assert.equal(services.db.volumes[0].type, "volume");
  assert.ok(volumes["postgres-data"]);
});

test("Compose rejects missing required secrets", () => {
  const result = config({ MIMS_APP_PASSWORD: "" });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /MIMS_APP_PASSWORD is required/);
});
