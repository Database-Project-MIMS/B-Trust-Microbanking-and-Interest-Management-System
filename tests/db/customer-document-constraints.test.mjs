import { after, afterEach, before, beforeEach, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createFixture, pool, rejectsSql } from '../helpers/customer-relations.mjs';

describe('P02-M02-T03: document metadata and verification constraints', () => {
  let client;
  let fixture;
  before(async () => { client = await pool.connect(); });
  beforeEach(async () => { await client.query('BEGIN'); fixture = await createFixture(client); });
  afterEach(async () => { await client.query('ROLLBACK'); });
  after(async () => { client?.release(); await pool.end(); });

  test('unverified metadata receives UUID/upload/created/updated defaults', async () => {
    const result = await client.query(
      `INSERT INTO customer_document (customer_id, doc_type, file_path) VALUES ($1,'NIC',$2)
       RETURNING doc_id, uploaded_date, created_at, updated_at, verified_by, verified_date, file_path`,
      [fixture.customerId, 'synthetic/nic.pdf'],
    );
    const row = result.rows[0];
    assert.match(row.doc_id, /^[0-9a-f-]{36}$/);
    assert.equal(row.verified_by, null);
    assert.equal(row.verified_date, null);
    assert.equal(row.file_path, 'synthetic/nic.pdf');
    for (const column of ['uploaded_date', 'created_at', 'updated_at']) assert.ok(row[column] instanceof Date);
  });
  test('verifier without date is rejected on insert', async () => {
    await rejectsSql(client, () => fixture.document({ verified_by: fixture.managerId }),
      '23514', 'ck_customer_document_verification');
  });
  test('date without verifier is rejected on insert', async () => {
    await rejectsSql(client, () => fixture.document({ verified_date: '2026-01-01T00:00:00Z' }),
      '23514', 'ck_customer_document_verification');
  });
  test('both verification fields can be inserted together', async () => {
    const row = await fixture.document({ verified_by: fixture.managerId, verified_date: '2026-01-01T00:00:00Z' });
    assert.equal(row.verified_by, fixture.managerId);
    assert.equal(row.verified_date.toISOString(), '2026-01-01T00:00:00.000Z');
  });
  test('updating only verifier is rejected', async () => {
    const row = await fixture.document();
    await rejectsSql(client, () => client.query('UPDATE customer_document SET verified_by = $1 WHERE doc_id = $2',
      [fixture.managerId, row.doc_id]), '23514', 'ck_customer_document_verification');
  });
  test('updating only date is rejected', async () => {
    const row = await fixture.document();
    await rejectsSql(client, () => client.query('UPDATE customer_document SET verified_date = now() WHERE doc_id = $1',
      [row.doc_id]), '23514', 'ck_customer_document_verification');
  });
  test('updating both fields succeeds and removing only one fails', async () => {
    const row = await fixture.document();
    await client.query('UPDATE customer_document SET verified_by = $1, verified_date = now() WHERE doc_id = $2',
      [fixture.managerId, row.doc_id]);
    await rejectsSql(client, () => client.query('UPDATE customer_document SET verified_date = NULL WHERE doc_id = $1',
      [row.doc_id]), '23514', 'ck_customer_document_verification');
  });
  test('unknown customer is rejected', async () => {
    await rejectsSql(client, () => fixture.document({ customer_id: randomUUID() }), '23503', 'fk_customer_document_customer');
  });
  test('unknown verifier is rejected', async () => {
    await rejectsSql(client, () => fixture.document({ verified_by: randomUUID(), verified_date: '2026-01-01T00:00:00Z' }),
      '23503', 'fk_customer_document_verifier');
  });
  test('customer referenced by a document cannot be deleted', async () => {
    await fixture.document();
    await rejectsSql(client, () => client.query('DELETE FROM customer WHERE customer_id = $1', [fixture.customerId]),
      ['23001', '23503'], 'fk_customer_document_customer');
  });
  test('verifier login cannot be deleted while referenced', async () => {
    await fixture.document({ verified_by: fixture.customerLoginId, verified_date: '2026-01-01T00:00:00Z' });
    await rejectsSql(client, () => client.query('DELETE FROM app_user WHERE user_id = $1', [fixture.customerLoginId]),
      ['23001', '23503'], 'fk_customer_document_verifier');
  });
  for (const column of ['customer_id', 'doc_type', 'file_path', 'uploaded_date', 'created_at', 'updated_at']) {
    test(`required ${column} rejects NULL`, async () => {
      if (['created_at', 'uploaded_date'].includes(column)) {
        // Static SQL allow-list; no identifier originates in input.
        const statements = {
          created_at: 'INSERT INTO customer_document (customer_id,doc_type,file_path,created_at) VALUES ($1,$2,$3,NULL)',
          uploaded_date: 'INSERT INTO customer_document (customer_id,doc_type,file_path,uploaded_date) VALUES ($1,$2,$3,NULL)',
        };
        await rejectsSql(client, () => client.query(statements[column], [fixture.customerId, 'NIC', 'synthetic/nic.pdf']),
          '23502', column, 'column');
      } else await rejectsSql(client, () => fixture.document({ [column]: null }), '23502', column, 'column');
    });
  }
  test('type length above 50 is rejected', async () => {
    await assert.rejects(() => fixture.document({ doc_type: 'x'.repeat(51) }), { code: '22001' });
  });
  test('path length above 500 is rejected', async () => {
    await assert.rejects(() => fixture.document({ file_path: 'x'.repeat(501) }), { code: '22001' });
  });
  test('a customer may hold multiple documents', async () => {
    await fixture.document();
    await fixture.document({ doc_type: 'ADDRESS_PROOF', file_path: 'synthetic/address.pdf' });
    const result = await client.query('SELECT count(*)::int AS count FROM customer_document WHERE customer_id = $1', [fixture.customerId]);
    assert.equal(result.rows[0].count, 2);
  });
  test('verification maintains updated_at but preserves upload/creation dates', async () => {
    const row = await fixture.document();
    const result = await client.query(
      `UPDATE customer_document SET verified_by = $1, verified_date = now() WHERE doc_id = $2
       RETURNING uploaded_date, created_at, updated_at`, [fixture.managerId, row.doc_id],
    );
    assert.deepEqual(result.rows[0].uploaded_date, row.uploaded_date);
    assert.deepEqual(result.rows[0].created_at, row.created_at);
    assert.ok(result.rows[0].updated_at > row.updated_at);
  });
  test('customer lookup index exists', async () => {
    const result = await client.query('SELECT indexdef FROM pg_indexes WHERE indexname = $1', ['ix_customer_document_customer']);
    assert.match(result.rows[0].indexdef, /\(customer_id\)/);
  });
  test('runtime child access remains denied pending scoped M1 grants', async () => {
    for (const table of ['customer_agent', 'customer_document']) {
      const result = await client.query(
        `SELECT has_table_privilege('mims_app', $1, 'SELECT') AS read,
                has_table_privilege('mims_app', $1, 'UPDATE') AS update`, [table],
      );
      assert.deepEqual(result.rows[0], { read: false, update: false });
    }
  });
});
