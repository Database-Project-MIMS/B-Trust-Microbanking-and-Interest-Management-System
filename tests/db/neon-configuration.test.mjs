import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { validateNeonMigrationUrl } from "../../scripts/check-neon-migration-env.mjs";

// Synthetic endpoint and credential used only to exercise configuration checks.
const fixture = "postgresql://mims_owner:synthetic-test-password@ep-example.us-east-2.aws.neon.tech/neondb?sslmode=require";

test("Neon migration configuration accepts direct owner connections requiring TLS", () => {
  for (const mode of ["require", "verify-ca", "verify-full"]) {
    assert.doesNotThrow(() => validateNeonMigrationUrl(fixture.replace("sslmode=require", `sslmode=${mode}`)));
  }
});

test("Neon migration configuration rejects missing, malformed, pooled, runtime and insecure URLs", () => {
  for (const value of [undefined, "", "not-a-url", fixture.replace("postgresql:", "https:"),
    fixture.replace("ep-example.", "ep-example-pooler."), fixture.replace("mims_owner:", "mims_app:"),
    fixture.replace(".neon.tech", ".example.com"), fixture.replace(".neon.tech", ".neon.tech.attacker.example"),
    fixture.replace("/neondb?", "/?"), fixture.replace(":synthetic-test-password", ":"),
    fixture.replace("?sslmode=require", ""), fixture.replace("sslmode=require", "sslmode=disable"),
    fixture.replace("sslmode=require", "sslmode=prefer"), fixture + "&sslmode=disable", fixture + "#fragment"]) {
    assert.throws(() => validateNeonMigrationUrl(value));
  }
});

test("invalid deployment credentials fail without printing their values or falling back to runtime credentials", () => {
  for (const value of ["", fixture.replace("sslmode=require", "sslmode=disable"), "synthetic-test-password"]) {
    const result = spawnSync(process.execPath, ["scripts/check-neon-migration-env.mjs"], {
      env: { ...process.env, DATABASE_MIGRATION_URL: value, DATABASE_URL: fixture },
      encoding: "utf8", windowsHide: true,
    });
    assert.equal(result.status, 1);
    assert.doesNotMatch(result.stdout + result.stderr, /synthetic-test-password|ep-example/);
  }
});

test("the tracked environment example leaves all connection and secret fields empty", () => {
  const example = readFileSync(".env.example", "utf8");
  for (const name of ["DATABASE_URL", "DATABASE_MIGRATION_URL", "SESSION_SECRET", "CSRF_SECRET", "INTEREST_WORKER_TOKEN"]) {
    assert.match(example, new RegExp(`^${name}=\\s*$`, "m"));
  }
  assert.doesNotMatch(example, /postgres(?:ql)?:\/\/|neon\.tech/);
});
