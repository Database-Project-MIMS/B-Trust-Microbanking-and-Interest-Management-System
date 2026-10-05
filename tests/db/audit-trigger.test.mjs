import { describe, it, after } from 'node:test';
import assert from 'node:assert/strict';
import pg from 'pg';

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

describe('P01-M01-T05 — Audit Log & System Parameters', () => {
  after(() => pool.end());

  it('system_parameter: WITHDRAWAL_SINGLE_LIMIT is seeded correctly', async () => {
    const { rows } = await pool.query(
      `SELECT param_value FROM system_parameter WHERE param_key = 'WITHDRAWAL_SINGLE_LIMIT'`
    );
    assert.equal(rows.length, 1);
    assert.equal(parseFloat(rows[0].param_value), 100000.00);
  });

  it('system_parameter: all 7 seed rows exist', async () => {
    const { rows } = await pool.query(`SELECT COUNT(*) AS n FROM system_parameter`);
    assert.ok(parseInt(rows[0].n) >= 7);
  });

  it('trg_audit_system_parameter: UPDATE writes to audit_log', async () => {
    const before = await pool.query(`SELECT COUNT(*) AS n FROM audit_log WHERE entity_type = 'system_parameter'`);
    await pool.query(`UPDATE system_parameter SET param_value = '100001.00', updated_at = now() WHERE param_key = 'WITHDRAWAL_SINGLE_LIMIT'`);
    const after = await pool.query(`SELECT COUNT(*) AS n FROM audit_log WHERE entity_type = 'system_parameter'`);
    assert.ok(parseInt(after.rows[0].n) > parseInt(before.rows[0].n));
    // Restore
    await pool.query(`UPDATE system_parameter SET param_value = '100000.00', updated_at = now() WHERE param_key = 'WITHDRAWAL_SINGLE_LIMIT'`);
  });

  it('audit_log UPDATE row has old_values and new_values', async () => {
    const { rows } = await pool.query(
      `SELECT old_values, new_values FROM audit_log
       WHERE entity_type = 'system_parameter' AND action = 'UPDATE'
       ORDER BY logged_at DESC LIMIT 1`
    );
    assert.ok(rows.length > 0);
    assert.ok(rows[0].old_values !== null);
    assert.ok(rows[0].new_values !== null);
  });

  it('audit_log: UPDATE is rejected', async () => {
    const { rows } = await pool.query(`SELECT log_id FROM audit_log LIMIT 1`);
    assert.ok(rows.length > 0);
    await assert.rejects(
      () => pool.query(`UPDATE audit_log SET action = 'TAMPERED' WHERE log_id = $1`, [rows[0].log_id]),
      /(immutable|permission denied)/i
    );
  });

  it('audit_log: DELETE is rejected', async () => {
    const { rows } = await pool.query(`SELECT log_id FROM audit_log LIMIT 1`);
    assert.ok(rows.length > 0);
    await assert.rejects(
      () => pool.query(`DELETE FROM audit_log WHERE log_id = $1`, [rows[0].log_id]),
      /(immutable|permission denied)/i
    );
  });

  it('fn_is_business_hour: true at 10:00 on a normal weekday', async () => {
    const { rows } = await pool.query(
      `SELECT fn_is_business_hour('2025-04-02 10:00:00+05:30'::timestamptz) AS result`
    );
    assert.equal(rows[0].result, true);
  });

  it('fn_is_business_hour: false on a seeded Poya holiday', async () => {
    const { rows } = await pool.query(
      `SELECT fn_is_business_hour('2025-01-13 10:00:00+05:30'::timestamptz) AS result`
    );
    assert.equal(rows[0].result, false);
  });

  it('fn_is_business_hour: false before opening time', async () => {
    const { rows } = await pool.query(
      `SELECT fn_is_business_hour('2025-04-02 07:00:00+05:30'::timestamptz) AS result`
    );
    assert.equal(rows[0].result, false);
  });
});
