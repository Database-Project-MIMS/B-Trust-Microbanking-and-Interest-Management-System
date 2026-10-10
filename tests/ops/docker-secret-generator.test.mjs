import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve, sep } from "node:path";

const script = resolve("scripts/configure-docker.mjs");
test("Docker secret generator preserves existing files and generates separate local/Neon configuration", () => {
  const workspace = mkdtempSync(join(tmpdir(), "mims-docker-config-"));
  const run = args => spawnSync(process.execPath, [script, ...args], { cwd: workspace, encoding: "utf8", windowsHide: true });
  try {
    for (const [args, name] of [[[], ".env.docker"], [["--neon"], ".env.neon"]]) {
      const first = run(args);
      assert.equal(first.status, 0, first.stderr);
      const original = readFileSync(join(workspace, name), "utf8");
      const values = Object.fromEntries(original.trim().split("\n").map(line => {
        const index = line.indexOf("=");
        return [line.slice(0, index), line.slice(index + 1)];
      }));
      for (const key of ["SESSION_SECRET", "CSRF_SECRET", "INTEREST_WORKER_TOKEN"]) {
        assert.match(values[key], /^[a-f0-9]{64}$/);
        assert.ok(!first.stdout.includes(values[key]));
      }
      assert.equal(new Set([values.SESSION_SECRET, values.CSRF_SECRET, values.INTEREST_WORKER_TOKEN]).size, 3);
      if (name === ".env.neon") {
        assert.equal(values.NEON_DATABASE_URL, "");
        assert.equal(values.MIMS_NEON_HTTP_PORT, "3001");
        assert.equal(values.MIMS_OWNER_PASSWORD, undefined);
        assert.equal(values.MIMS_POSTGRES_PASSWORD, undefined);
      } else {
        assert.match(values.MIMS_OWNER_PASSWORD, /^[a-f0-9]{64}$/);
        assert.equal(values.MIMS_HTTP_PORT, "3000");
      }
      assert.equal(run(args).status, 1);
      assert.equal(readFileSync(join(workspace, name), "utf8"), original);
    }
    assert.equal(run(["--unknown"]).status, 1);
    assert.deepEqual(readdirSync(workspace).sort(), [".env.docker", ".env.neon"]);
  } finally {
    const absolute = resolve(workspace);
    assert.ok(absolute.startsWith(resolve(tmpdir()) + sep)
      && absolute.split(/[\\/]/).pop().startsWith("mims-docker-config-"));
    rmSync(absolute, { recursive: true, force: true });
  }
});
