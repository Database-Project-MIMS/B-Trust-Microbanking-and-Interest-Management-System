import { after, before, beforeEach, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createFixture, pool, requireDisposableDatabase } from '../helpers/customer-relations.mjs';
const { verifyDocument } = await import('../../services/customer-document-service.ts');

describe('P02-M02-T03: verification service and concurrent relation writes', () => {
  let client;
  let fixture;
  let document;
  before(async () => {
    client = await pool.connect();
    // This suite needs committed rows visible to service transactions. Never run on dev.
    await requireDisposableDatabase(client);
  });
  beforeEach(async () => {
    await client.query('BEGIN');
    try {
      fixture = await createFixture(client);
      document = await fixture.document();
      await client.query('COMMIT');
    } catch (error) { await client.query('ROLLBACK'); throw error; }
  });
  after(async () => { client?.release(); await pool.end(); });

  async function auditRows() {
    return (await client.query(
      'SELECT user_id, actor_type, entity_type, entity_id, action, old_values, new_values FROM audit_log WHERE entity_id = $1',
      [document.doc_id],
    )).rows;
  }
  async function stored() {
    return (await client.query(
      'SELECT verified_by, verified_date, uploaded_date, created_at, updated_at FROM customer_document WHERE doc_id = $1',
      [document.doc_id],
    )).rows[0];
  }
  test('manager verifies in own branch with one minimal audit event', async () => {
    const result = await verifyDocument(document.doc_id, fixture.managerId);
    assert.equal(result.docId, document.doc_id);
    assert.equal(result.customerId, fixture.customerId);
    assert.equal(result.verifiedBy, fixture.managerId);
    assert.ok(result.verifiedDate instanceof Date);
    const row = await stored();
    assert.equal(row.verified_by, result.verifiedBy);
    assert.deepEqual(row.verified_date, result.verifiedDate);
    assert.deepEqual(row.uploaded_date, document.uploaded_date);
    assert.deepEqual(row.created_at, document.created_at);
    assert.ok(row.updated_at > document.updated_at);
    const audit = await auditRows();
    assert.equal(audit.length, 1);
    assert.deepEqual(audit[0], {
      user_id: fixture.managerId, actor_type: 'USER', entity_type: 'customer_document', entity_id: document.doc_id,
      action: 'UPDATE', old_values: { verified_by: null, verified_date: null },
      new_values: { verified_by: fixture.managerId, verified_date: result.verifiedDate.toISOString() },
    });
  });
  test('currently assigned agent can verify', async () => {
    await fixture.assignment();
    assert.equal((await verifyDocument(document.doc_id, fixture.agentId)).verifiedBy, fixture.agentId);
  });
  test('unassigned agent in the same branch is denied without effects', async () => {
    await fixture.assignment();
    await assert.rejects(() => verifyDocument(document.doc_id, fixture.secondAgentId), { code: 'NOT_AUTHORIZED' });
    assert.equal((await stored()).verified_by, null);
    assert.equal((await auditRows()).length, 0);
  });
  test('old inactive assignment grants no verification access', async () => {
    await fixture.assignment({ is_active: false, end_date: '2021-01-01' });
    await assert.rejects(() => verifyDocument(document.doc_id, fixture.agentId), { code: 'NOT_AUTHORIZED' });
  });
  test('manager from another branch is denied without effects', async () => {
    await assert.rejects(() => verifyDocument(document.doc_id, fixture.otherManagerId), { code: 'NOT_AUTHORIZED' });
    assert.equal((await stored()).verified_date, null);
    assert.equal((await auditRows()).length, 0);
  });
  for (const role of ['CUSTOMER', 'AUDITOR', 'CENTRAL_OPS', 'ADMIN']) {
    test(`${role} is denied under the customer mutation role contract`, async () => {
      const userId = role === 'CUSTOMER' ? fixture.customerLoginId : await fixture.staff(role);
      await assert.rejects(() => verifyDocument(document.doc_id, userId), { code: 'NOT_AUTHORIZED' });
      assert.equal((await auditRows()).length, 0);
    });
  }
  test('inactive login is denied', async () => {
    await client.query("UPDATE app_user SET status = 'INACTIVE' WHERE user_id = $1", [fixture.managerId]);
    await assert.rejects(() => verifyDocument(document.doc_id, fixture.managerId), { code: 'NOT_AUTHORIZED' });
  });
  test('inactive staff profile is denied', async () => {
    await client.query("UPDATE agent SET status = 'INACTIVE' WHERE agent_id = $1", [fixture.managerId]);
    await assert.rejects(() => verifyDocument(document.doc_id, fixture.managerId), { code: 'NOT_AUTHORIZED' });
  });
  test('missing staff profile fails closed', async () => {
    await client.query('DELETE FROM agent WHERE agent_id = $1', [fixture.managerId]);
    await assert.rejects(() => verifyDocument(document.doc_id, fixture.managerId), { code: 'NOT_AUTHORIZED' });
  });
  test('inactive customer is denied', async () => {
    await client.query("UPDATE customer SET status = 'INACTIVE' WHERE customer_id = $1", [fixture.customerId]);
    await assert.rejects(() => verifyDocument(document.doc_id, fixture.managerId), { code: 'NOT_AUTHORIZED' });
  });
  test('malformed UUIDs return validation errors before executing SQL', async () => {
    await assert.rejects(() => verifyDocument("' OR 1=1 --", fixture.managerId), { code: 'VALIDATION_FAILED' });
    await assert.rejects(() => verifyDocument(document.doc_id, 'invalid'), { code: 'VALIDATION_FAILED' });
  });
  test('missing document gives a safe typed not-found error', async () => {
    await assert.rejects(() => verifyDocument(randomUUID(), fixture.managerId), { code: 'NOT_FOUND', message: 'Document was not found.' });
  });
  test('unknown verifier is denied before document lookup', async () => {
    await assert.rejects(() => verifyDocument(randomUUID(), randomUUID()), { code: 'NOT_AUTHORIZED' });
  });
  test('same-verifier retry preserves timestamp and produces no second audit', async () => {
    const first = await verifyDocument(document.doc_id, fixture.managerId);
    assert.deepEqual(await verifyDocument(document.doc_id, fixture.managerId), first);
    assert.equal((await auditRows()).length, 1);
  });
  test('another verifier cannot replace original attribution', async () => {
    await fixture.assignment();
    await verifyDocument(document.doc_id, fixture.managerId);
    await assert.rejects(() => verifyDocument(document.doc_id, fixture.agentId), { code: 'DOCUMENT_ALREADY_VERIFIED' });
    assert.equal((await stored()).verified_by, fixture.managerId);
    assert.equal((await auditRows()).length, 1);
  });
  test('concurrent retries commit one verification and one audit', async () => {
    const [first, second] = await Promise.all([
      verifyDocument(document.doc_id, fixture.managerId), verifyDocument(document.doc_id, fixture.managerId),
    ]);
    assert.deepEqual(first, second);
    assert.equal((await auditRows()).length, 1);
  });
  test('concurrent different verifiers preserve the first successful writer', async () => {
    await fixture.assignment();
    const results = await Promise.allSettled([
      verifyDocument(document.doc_id, fixture.managerId), verifyDocument(document.doc_id, fixture.agentId),
    ]);
    const accepted = results.filter(result => result.status === 'fulfilled');
    const rejected = results.filter(result => result.status === 'rejected');
    assert.equal(accepted.length, 1);
    assert.equal(rejected.length, 1);
    assert.equal(rejected[0].reason.code, 'DOCUMENT_ALREADY_VERIFIED');
    assert.equal((await stored()).verified_by, accepted[0].value.verifiedBy);
    assert.equal((await auditRows()).length, 1);
  });
  test('audit insert failure rolls back both verification fields and updated_at', async () => {
    const original = await stored();
    await client.query(`CREATE FUNCTION test_reject_document_audit() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN IF NEW.entity_type = 'customer_document' THEN
        RAISE EXCEPTION 'Synthetic audit failure' USING ERRCODE = '23514', CONSTRAINT = 'test_audit_failure';
      END IF; RETURN NEW; END $$`);
    await client.query(`CREATE TRIGGER test_reject_document_audit BEFORE INSERT ON audit_log
      FOR EACH ROW EXECUTE FUNCTION test_reject_document_audit()`);
    try {
      await assert.rejects(() => verifyDocument(document.doc_id, fixture.managerId), error => {
        assert.equal(error.code, 'CHECK_VIOLATION');
        assert.equal(error.message, 'The operation violates a data integrity rule.');
        return true;
      });
      assert.deepEqual(await stored(), original);
      assert.equal((await auditRows()).length, 0);
    } finally {
      await client.query('DROP TRIGGER test_reject_document_audit ON audit_log');
      await client.query('DROP FUNCTION test_reject_document_audit()');
    }
  });

  for (const winnerCommits of [true, false]) {
    test(`concurrent active assignment waits and ${winnerCommits ? 'rejects after winner commit' : 'succeeds after winner rollback'}`, async () => {
      const winner = await pool.connect();
      const contender = await pool.connect();
      let pending;
      try {
        await winner.query('BEGIN');
        await contender.query('BEGIN');
        const winnerPid = (await winner.query('SELECT pg_backend_pid() AS pid')).rows[0].pid;
        const contenderPid = (await contender.query('SELECT pg_backend_pid() AS pid')).rows[0].pid;
        await winner.query('INSERT INTO customer_agent (customer_id, agent_id) VALUES ($1,$2)', [fixture.customerId, fixture.agentId]);
        // Handle rejection immediately so a blocked INSERT cannot cause an unhandled rejection.
        pending = contender.query('INSERT INTO customer_agent (customer_id, agent_id) VALUES ($1,$2)',
          [fixture.customerId, fixture.secondAgentId]).then(result => ({ result }), error => ({ error }));
        let blocked = false;
        const deadline = Date.now() + 3000;
        while (Date.now() < deadline) {
          const result = await client.query('SELECT $2::int = ANY(pg_blocking_pids($1::int)) AS blocked', [contenderPid, winnerPid]);
          if (result.rows[0].blocked) { blocked = true; break; }
          await new Promise(resolve => setTimeout(resolve, 10));
        }
        assert.ok(blocked, 'Partial unique index must block a competing uncommitted assignment.');
        await winner.query(winnerCommits ? 'COMMIT' : 'ROLLBACK');
        const outcome = await pending;
        if (winnerCommits) {
          assert.equal(outcome.error?.code, '23505');
          assert.equal(outcome.error.constraint, 'ux_customer_agent_one_active');
          await contender.query('ROLLBACK');
        } else {
          assert.equal(outcome.error, undefined);
          await contender.query('COMMIT');
        }
        const active = await client.query('SELECT agent_id FROM customer_agent WHERE customer_id = $1 AND is_active', [fixture.customerId]);
        assert.deepEqual(active.rows, [{ agent_id: winnerCommits ? fixture.agentId : fixture.secondAgentId }]);
      } finally {
        await winner.query('ROLLBACK');
        if (pending) await pending;
        await contender.query('ROLLBACK');
        winner.release(); contender.release();
      }
    });
  }
});
