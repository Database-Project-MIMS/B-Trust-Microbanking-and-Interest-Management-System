import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { checkDeploymentEnvironment } from '../../scripts/check-deployment-security.mjs';
import { spawnSync } from 'node:child_process';
import { copyFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { createRequire } from 'node:module';
import nextConfig from '../../next.config.mjs';

const valid = {
  NODE_ENV: 'production',
  APP_BASE_URL: 'https://bank.example.invalid',
  DATABASE_URL: 'postgresql://mims_app:synthetic-test-password@db.internal:5432/mims',
  SESSION_SECRET: 'a'.repeat(32),
  CSRF_SECRET: 'b'.repeat(32),
  INTEREST_WORKER_TOKEN: 'c'.repeat(32),
};

describe('P06-M01-T04 deployment environment', () => {
  test('Next loads production, development and Docker config without TypeScript', () => {
    const directory = mkdtempSync(join(tmpdir(), 'mims-next-config-'));
    const require = createRequire(import.meta.url);
    const loader = require.resolve('next/dist/server/config');
    // Use Next's real loader in a fresh process and deny compiler resolution,
    // reproducing a runtime that has omitted development dependencies.
    const script = `
      const Module = require('node:module');
      const resolve = Module._resolveFilename;
      Module._resolveFilename = function (name, ...args) {
        if (name === 'typescript' || name.startsWith('typescript/')) {
          throw Object.assign(new Error('TypeScript is absent'), { code: 'MODULE_NOT_FOUND' });
        }
        return resolve.call(this, name, ...args);
      };
      (async () => {
        const loadConfig = require(${JSON.stringify(loader)}).default;
        const config = await loadConfig('phase-production-build', process.cwd());
        console.log(JSON.stringify({
          distDir: config.distDir, output: config.output,
          external: config.serverExternalPackages, headers: await config.headers(),
        }));
      })().catch(error => { console.error(error); process.exitCode = 1; });
    `;
    try {
      copyFileSync(new URL('../../next.config.mjs', import.meta.url), join(directory, 'next.config.mjs'));
      for (const [mode, standalone, expectedDirectory] of [
        ['production', '', '.next'], ['development', '', '.next-dev'], ['production', '1', '.next'],
      ]) {
        const result = spawnSync(process.execPath, ['-e', script], {
          cwd: directory, encoding: 'utf8', timeout: 30_000,
          env: { ...process.env, NODE_ENV: mode, MIMS_STANDALONE: standalone, NEXT_TELEMETRY_DISABLED: '1' },
        });
        assert.equal(result.status, 0, result.error?.message ?? result.stderr);
        const config = JSON.parse(result.stdout.trim());
        assert.equal(config.distDir, expectedDirectory);
        assert.equal(config.output, standalone ? 'standalone' : undefined);
        assert.deepEqual(config.external, ['pg', 'argon2']);
        const headers = Object.fromEntries(config.headers[0].headers.map(({ key, value }) => [key, value]));
        assert.equal(headers['X-Frame-Options'], 'DENY');
        assert.equal(headers['Strict-Transport-Security'], mode === 'production' ? 'max-age=31536000' : undefined);
      }
    } finally {
      assert.equal(dirname(resolve(directory)), resolve(tmpdir()));
      rmSync(directory, { recursive: true, force: true });
    }
  });

  test('accepts a separate least-privilege runtime configuration', () => {
    assert.deepEqual(checkDeploymentEnvironment(valid), []);
  });

  test('rejects HTTP, loopback and URL credentials', () => {
    for (const base of ['http://bank.example.invalid', 'https://localhost:3000',
      'https://user:pass@bank.example.invalid']) {
      assert.match(checkDeploymentEnvironment({ ...valid, APP_BASE_URL: base }).join(' '), /APP_BASE_URL/);
    }
  });

  test('rejects owner credentials, placeholders and migration credentials at runtime', () => {
    assert.match(checkDeploymentEnvironment({ ...valid, DATABASE_URL: valid.DATABASE_URL.replace('mims_app', 'mims_owner') }).join(' '), /DATABASE_URL/);
    assert.match(checkDeploymentEnvironment({ ...valid, SESSION_SECRET: 'CHANGE_ME' }).join(' '), /SESSION_SECRET/);
    assert.match(checkDeploymentEnvironment({ ...valid, DATABASE_MIGRATION_URL: 'synthetic' }).join(' '), /DATABASE_MIGRATION_URL/);
  });

  test('rejects public variables that name or duplicate credentials', () => {
    assert.match(checkDeploymentEnvironment({ ...valid, NEXT_PUBLIC_API_TOKEN: 'synthetic' }).join(' '), /NEXT_PUBLIC_API_TOKEN/);
    assert.match(checkDeploymentEnvironment({ ...valid, NEXT_PUBLIC_VALUE: valid.CSRF_SECRET }).join(' '), /NEXT_PUBLIC_VALUE/);
    assert.match(checkDeploymentEnvironment({ ...valid, NEXT_PUBLIC_VALUE: valid.DATABASE_URL.replace('mims_app', 'someone') }).join(' '), /NEXT_PUBLIC_VALUE/);
  });

  test('sends production HSTS and baseline security headers', async () => {
    const previous = process.env.NODE_ENV;
    try {
      process.env.NODE_ENV = 'production';
      const config = nextConfig.default ?? nextConfig;
      const rules = await config.headers();
      const headers = Object.fromEntries(rules[0].headers.map(({ key, value }) => [key, value]));
      assert.equal(headers['Strict-Transport-Security'], 'max-age=31536000');
      assert.equal(headers['X-Frame-Options'], 'DENY');
      assert.equal(headers['X-Content-Type-Options'], 'nosniff');
      assert.equal(headers['Referrer-Policy'], 'strict-origin-when-cross-origin');
      assert.match(headers['Permissions-Policy'], /camera=\(\)/);
    } finally {
      if (previous === undefined) delete process.env.NODE_ENV;
      else process.env.NODE_ENV = previous;
    }
  });

  test('does not advertise HSTS for local development', async () => {
    const previous = process.env.NODE_ENV;
    try {
      process.env.NODE_ENV = 'development';
      const config = nextConfig.default ?? nextConfig;
      const rules = await config.headers();
      assert.equal(rules[0].headers.some(header => header.key === 'Strict-Transport-Security'), false);
    } finally {
      if (previous === undefined) delete process.env.NODE_ENV;
      else process.env.NODE_ENV = previous;
    }
  });
});
