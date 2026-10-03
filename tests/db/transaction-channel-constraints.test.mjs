import test from 'node:test';
import assert from 'node:assert/strict';
import { query } from '../../lib/db/index.ts';

test('Transaction Channel Schema Constraints', async (t) => {
    await t.test('1. Exactly the three seeded channels exist', async () => {
        const rows = await query('SELECT channel_name FROM transaction_channel ORDER BY channel_name');
        const names = rows.map(r => r.channel_name);
        assert.deepEqual(names, ['BRANCH_COUNTER', 'ONLINE', 'SYSTEM']);
    });

    await t.test('2. Duplicate channel_name is rejected (23505)', async () => {
        await assert.rejects(
            query(`INSERT INTO transaction_channel (channel_name) VALUES ('ONLINE')`),
            (err) => err.code === '23505'
        );
    });

    await t.test('3. Invalid status values are rejected', async () => {
        await assert.rejects(
            query(`INSERT INTO transaction_channel (channel_name, status) VALUES ('KIOSK', 'PENDING')`),
            (err) => err.code === '23514'
        );
    });
});