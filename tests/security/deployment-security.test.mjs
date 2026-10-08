import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { checkDeploymentEnvironment } from '../../scripts/check-deployment-security.mjs';
import nextConfig from '../../next.config.ts';

const valid = {
  NODE_ENV: 'production',
  APP_BASE_URL: 'https://bank.example.invalid',
  DATABASE_URL: 'postgresql://mims_app:synthetic-test-password@db.internal:5432/mims',
  SESSION_SECRET: 'a'.repeat(32),
  CSRF_SECRET: 'b'.repeat(32),
  INTEREST_WORKER_TOKEN: 'c'.repeat(32),
};

describe('P06-M01-T04 deployment environment', () => {
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
