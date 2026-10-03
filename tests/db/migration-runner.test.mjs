import test from 'node:test';
import assert from 'node:assert/strict';
import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';

test('Migration Runner & Verify', async (t) => {
    await t.test('1. db:rebuild from empty succeeds', () => {
        const out = execSync('npm run db:rebuild', { encoding: 'utf8' });
        assert.match(out, /All checks passed/);
    });

    await t.test('2. Re-running is idempotent', () => {
        const out = execSync('node scripts/migrate.mjs up', { encoding: 'utf8' });
        assert.doesNotMatch(out, /apply /);
    });

    await t.test('3. Modifying applied migration fails loudly', () => {
        // We modify an existing file instead of creating a new one to avoid DB cleanup permissions
        const filePath = 'database/migrations/0160_p01_m04_transaction_channel.sql';
        const original = readFileSync(filePath, 'utf8');
        try {
            writeFileSync(filePath, original + '\n-- tampered');
            assert.throws(() => execSync('node scripts/migrate.mjs up'), /immutable/);
        } finally {
            writeFileSync(filePath, original);
        }
    });

    await t.test('4. db:verify passes', () => {
        const out = execSync('node scripts/migrate.mjs verify', { encoding: 'utf8' });
        assert.match(out, /verify ok/);
    });
});