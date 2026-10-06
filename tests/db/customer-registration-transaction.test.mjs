import { after, before, beforeEach, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { actor, counts, createFixture, pool, registrationInput, requireDisposableDatabase } from '../helpers/customer-registration.mjs';
const { registerCustomer } = await import('../../services/customer-service.ts');

describe('P02-M02-T04: registration rollback at every later database stage', () => {
  let client;
  let fixture;
  before(async () => { client = await pool.connect(); await requireDisposableDatabase(client); });
  beforeEach(async () => {
    await client.query('BEGIN');
    try { fixture = await createFixture(client); await client.query('COMMIT'); }
    catch (error) { await client.query('ROLLBACK'); throw error; }
  });
  after(async () => { client?.release(); await pool.end(); });

  async function failureProbe(stage) {
    const table = stage === 'document' ? 'customer_document' : stage === 'assignment' ? 'customer_agent' : 'audit_log';
    const conditions = {
      document: "NEW.doc_type = 'FAIL_REGISTRATION_TEST'",
      assignment: 'true',
      audit: "NEW.entity_type = 'customer' AND NEW.action = 'INSERT'",
    };
    // Identifiers/conditions come solely from this test's fixed allow-list.
    await client.query(`CREATE FUNCTION test_fail_registration() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN IF ${conditions[stage]} THEN RAISE EXCEPTION 'Synthetic failure' USING ERRCODE = '23514',
        CONSTRAINT = 'test_registration_failure'; END IF; RETURN NEW; END $$`);
    await client.query(`CREATE TRIGGER test_fail_registration BEFORE INSERT ON ${table}
      FOR EACH ROW EXECUTE FUNCTION test_fail_registration()`);
    return async () => {
      await client.query(`DROP TRIGGER test_fail_registration ON ${table}`);
      await client.query('DROP FUNCTION test_fail_registration()');
    };
  }
  for (const stage of ['document', 'assignment', 'audit']) {
    test(`${stage} insert failure removes customer, earlier documents, assignment and audit`, async () => {
      const input = registrationInput(fixture);
      if (stage === 'document') input.documents[1].docType = 'FAIL_REGISTRATION_TEST';
      const baseline = await counts(client);
      const cleanup = await failureProbe(stage);
      try {
        await assert.rejects(() => registerCustomer(input, actor(fixture)), { code: 'CHECK_VIOLATION' });
        assert.deepEqual(await counts(client), baseline);
        const rows = await client.query('SELECT customer_id FROM customer WHERE nic_passport_no = $1', [input.nicPassportNo]);
        assert.equal(rows.rows.length, 0);
      } finally { await cleanup(); }
    });
  }
  test('exactly one current assignment and all documents exist at successful commit', async () => {
    const input = registrationInput(fixture);
    const baseline = await counts(client);
    const result = await registerCustomer(input, actor(fixture));
    assert.deepEqual(await counts(client), { customers: baseline.customers + 1, documents: baseline.documents + 2,
      assignments: baseline.assignments + 1, audits: baseline.audits + 2 });
    const assignments = await client.query('SELECT agent_id, is_active FROM customer_agent WHERE customer_id = $1', [result.customerId]);
    assert.deepEqual(assignments.rows, [{ agent_id: fixture.agentId, is_active: true }]);
    const documents = await client.query('SELECT verified_by, verified_date FROM customer_document WHERE customer_id = $1', [result.customerId]);
    assert.equal(documents.rows.length, 2);
    assert.ok(documents.rows.every(row => row.verified_by === null && row.verified_date === null));
  });
});
