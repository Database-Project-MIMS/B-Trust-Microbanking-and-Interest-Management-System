import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { NextRequest } from 'next/server';
import { fdFixture, pool, requireDisposableDatabase, financialSnapshot } from '../helpers/customer-fixed-deposits.mjs';
import { useCustomerRuntime } from '../helpers/customer-runtime.mjs';
import * as branches from '../../app/api/branches/[id]/route.ts';
import * as agents from '../../app/api/agents/[id]/route.ts';
import * as customers from '../../app/api/customers/[id]/route.ts';
import * as accounts from '../../app/api/accounts/[id]/route.ts';
import * as deposits from '../../app/api/fixed-deposits/[id]/route.ts';
import { getFixedDeposit } from '../../services/fixed-deposit-service.ts';

describe('P06-M02-T04: scoped record details and transactional editing under mims_app', () => {
  let client, fixture, restore;
  const csrf = randomBytes(32).toString('hex');
  before(async () => {
    client = await pool.connect(); await requireDisposableDatabase(client);
    fixture = await fdFixture(client);
    await client.query(`INSERT INTO joint_mandate(account_id,mandate_type,required_signatories)
      VALUES($1,'ALL_HOLDERS',2)`, [fixture.jointAccount.account_id]);
    restore = useCustomerRuntime(pool);
  });
  after(async () => { await restore?.(); client?.release(); await pool.end(); });
  function request(method, resource, id, body, role = 'manager', validCsrf = true) {
    return new NextRequest(`http://localhost/api/${resource}/${id}`, { method,
      headers: { cookie: `mims_session=${fixture.tokens[role]}; mims_csrf=${csrf}`,
        'x-csrf-token': validCsrf ? csrf : '', 'content-type': 'application/json' },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  }
  const context = id => ({ params: Promise.resolve({ id }) });
  async function data(response) {
    assert.equal(response.status, 200, await response.clone().text());
    return (await response.json()).data;
  }
  const patchCustomer = (body, role = 'agent', id = fixture.customerId, csrfValid = true) =>
    customers.PATCH(request('PATCH', 'customers', id, body, role, csrfValid), context(id));
  const patchAccount = (body, role = 'manager', id = fixture.jointAccount.account_id, csrfValid = true) =>
    accounts.PATCH(request('PATCH', 'accounts', id, body, role, csrfValid), context(id));
  test('branch and agent details expose registration fields with private caching and no login secrets', async () => {
    const branchResponse = await branches.GET(request('GET', 'branches', fixture.branchId), context(fixture.branchId));
    assert.equal(branchResponse.headers.get('cache-control'), 'private, no-store');
    const branch = await data(branchResponse); assert.equal(branch.address, 'Synthetic Road'); assert.equal(branch.district, 'Colombo');
    const agent = await data(await agents.GET(request('GET', 'agents', fixture.agentId), context(fixture.agentId)));
    for (const key of ['nicPassportNo', 'dateOfBirth', 'gender', 'address', 'hiredDate', 'username', 'email', 'createdAt']) assert.ok(agent[key]);
    // DATE values must remain calendar dates for native edit inputs, not timezone-shifted timestamps.
    assert.equal(agent.dateOfBirth, '1980-01-01'); assert.equal(agent.hiredDate, '2020-01-01');
    assert.doesNotMatch(JSON.stringify(agent), /password|token|hash/);
    const profile = await data(await customers.GET(request('GET', 'customers', fixture.customerId), context(fixture.customerId)));
    assert.equal(profile.branch.branchName, 'Synthetic Relation Branch'); assert.ok(profile.branch.branchCode);
    assert.ok(profile.customer.createdAt);
  });
  test('organization GET denies other branches, manager profiles and invalid IDs', async () => {
    for (const [module, resource, id, expected] of [
      [branches, 'branches', fixture.otherBranchId, 404], [agents, 'agents', fixture.otherManagerId, 404],
      [agents, 'agents', fixture.managerId, 404], [agents, 'agents', 'invalid', 400],
    ]) assert.equal((await module.GET(request('GET', resource, id), context(id))).status, expected);
    assert.equal((await agents.GET(request('GET', 'agents', fixture.agentId, undefined, 'agent'), context(fixture.agentId))).status, 403);
  });
  test('existing branch/agent edits persist and central read-only users cannot edit', async () => {
    const branch = await data(await branches.PATCH(request('PATCH', 'branches', fixture.branchId,
      { address: 'Updated synthetic road' }, 'admin'), context(fixture.branchId)));
    assert.equal(branch.address, 'Updated synthetic road');
    const agent = await data(await agents.PATCH(request('PATCH', 'agents', fixture.agentId,
      { phone: '0112223333' }), context(fixture.agentId)));
    assert.equal(agent.phone, '0112223333');
    assert.equal(agent.dateOfBirth, '1980-01-01'); assert.equal(agent.hiredDate, '2020-01-01');
    assert.equal((await agents.PATCH(request('PATCH', 'agents', fixture.agentId, { fullName: 'Denied' }, 'central'), context(fixture.agentId))).status, 403);
  });
  test('FD detail retains exact snapshots, links account, and limits holder names to each actor', async () => {
    const original = await financialSnapshot(client);
    for (const [role, expectedHolders] of [['manager', 2], ['agent', 1], ['customer', 1], ['central', 2], ['auditor', 2]]) {
      const result = await data(await deposits.GET(request('GET', 'fixed-deposits', fixture.jointId, undefined, role), context(fixture.jointId)));
      assert.equal(result.accountId, fixture.jointAccount.account_id); assert.equal(result.accountNumber, fixture.jointAccount.account_number);
      assert.equal(result.principalAmount, '200000.20'); assert.equal(result.rate, '0.1375'); assert.equal(result.holders.length, expectedHolders);
      assert.ok(result.holders.every(holder => holder.fullName && holder.customerNumber));
      assert.equal(result.account.branchId, fixture.branchId); assert.equal(result.account.currentBalance, '123456.78');
      assert.doesNotMatch(JSON.stringify(result.holders), /nic|email|address|passport/i);
    }
    const max = await data(await deposits.GET(request('GET', 'fixed-deposits', fixture.activeId), context(fixture.activeId)));
    assert.equal(max.principalAmount, '9999999999999.99');
    assert.deepEqual(await financialSnapshot(client), original);
  });
  test('FD detail denies foreign/unassigned/unknown records and has no financial edit handler', async () => {
    assert.equal((await deposits.GET(request('GET', 'fixed-deposits', fixture.otherId), context(fixture.otherId))).status, 404);
    assert.equal((await deposits.GET(request('GET', 'fixed-deposits', fixture.activeId, undefined, 'second'), context(fixture.activeId))).status, 404);
    assert.equal((await deposits.GET(request('GET', 'fixed-deposits', randomUUID()), context(randomUUID()))).status, 404);
    assert.equal((await deposits.GET(request('GET', 'fixed-deposits', 'invalid'), context('invalid'))).status, 400);
    assert.equal(deposits.PATCH, undefined);
  });
  test('FD service rejects stale stored actor role and branch even when invoked directly', async () => {
    await assert.rejects(getFixedDeposit(fixture.activeId, { userId: fixture.agentId, roleName: 'CENTRAL_OPS', branchId: null }), error => error.status === 403);
    await assert.rejects(getFixedDeposit(fixture.activeId, { userId: fixture.agentId, roleName: 'AGENT', branchId: fixture.otherBranchId }), error => error.status === 403);
  });
  test('assigned agent contact edits commit one sanitized audit, with nullable clearing and unchanged identity', async () => {
    const before = (await client.query('SELECT nic_passport_no,date_of_birth::text,email FROM customer WHERE customer_id=$1', [fixture.customerId])).rows[0];
    const audits = (await client.query("SELECT count(*)::int AS n FROM audit_log WHERE entity_type='customer' AND entity_id=$1", [fixture.customerId])).rows[0].n;
    const updated = await data(await patchCustomer({ fullName: 'Edited Synthetic Customer', gender: 'FEMALE', phone: '0111234567', address: 'Synthetic updated address' }));
    assert.equal(updated.fullName, 'Edited Synthetic Customer'); assert.equal(updated.gender, 'FEMALE');
    const afterRow = (await client.query('SELECT nic_passport_no,date_of_birth::text,email FROM customer WHERE customer_id=$1', [fixture.customerId])).rows[0];
    assert.deepEqual(afterRow, before);
    assert.equal((await client.query("SELECT count(*)::int AS n FROM audit_log WHERE entity_type='customer' AND entity_id=$1", [fixture.customerId])).rows[0].n, audits + 1);
    const audit = (await client.query("SELECT user_id,new_values FROM audit_log WHERE entity_type='customer' AND entity_id=$1 ORDER BY logged_at DESC LIMIT 1", [fixture.customerId])).rows[0];
    assert.equal(audit.user_id, fixture.agentId); assert.equal(audit.new_values.full_name, updated.fullName);
    assert.ok(!JSON.stringify(audit).includes(before.nic_passport_no));
    const cleared = await data(await patchCustomer({ phone: null, address: null })); assert.equal(cleared.phone, null); assert.equal(cleared.address, null);
  });
  test('email changes normalize, reject duplicates, and manager masking is never overwritten', async () => {
    const email = `EDIT-${randomUUID()}@EXAMPLE.INVALID`;
    assert.equal((await data(await patchCustomer({ email }))).email, email.toLowerCase());
    const manager = await data(await patchCustomer({ phone: '0119998888' }, 'manager')); assert.equal(manager.email, '***@***');
    assert.equal((await patchCustomer({ email: 'denied@example.invalid' }, 'manager')).status, 403);
    assert.equal((await patchCustomer({ email: '***@***' }, 'manager')).status, 400);
    const duplicate = (await client.query('SELECT email FROM customer WHERE customer_id=$1', [fixture.secondCustomerId])).rows[0].email;
    assert.equal((await patchCustomer({ email: duplicate })).status, 409);
    assert.equal((await client.query('SELECT email FROM customer WHERE customer_id=$1', [fixture.customerId])).rows[0].email, email.toLowerCase());
  });
  test('customer edit rejects bad role, assignment, branch, CSRF, unknown fields and registration invariants', async () => {
    const original = (await client.query('SELECT to_jsonb(c) AS value FROM customer c WHERE customer_id=$1', [fixture.customerId])).rows[0].value;
    for (const [body, role, id, expected, csrfValid] of [
      [{ fullName: 'Denied' }, 'auditor', fixture.customerId, 403, true], [{ fullName: 'Denied' }, 'second', fixture.customerId, 404, true],
      [{ fullName: 'Denied' }, 'otherManager', fixture.customerId, 404, true], [{ fullName: 'Denied' }, 'agent', fixture.customerId, 403, false],
      [{ dateOfBirth: '2000-01-01' }, 'agent', fixture.customerId, 400, true], [{ nicPassportNo: 'NEW0001' }, 'agent', fixture.customerId, 400, true],
      [{ branchId: fixture.otherBranchId }, 'agent', fixture.customerId, 400, true], [{ status: 'INACTIVE' }, 'agent', fixture.customerId, 400, true],
      [{}, 'agent', fixture.customerId, 400, true], [{ gender: 'OTHER' }, 'agent', fixture.customerId, 400, true],
    ]) assert.equal((await patchCustomer(body, role, id, csrfValid)).status, expected);
    assert.deepEqual((await client.query('SELECT to_jsonb(c) AS value FROM customer c WHERE customer_id=$1', [fixture.customerId])).rows[0].value, original);
  });
  test('account edit freezes/reactivates and changes joint authority atomically without changing money', async () => {
    const before = await financialSnapshot(client);
    await data(await patchAccount({ status: 'FROZEN', mandate: { type: 'ANY_ONE', effectiveFrom: '2026-01-01', effectiveTo: null } }));
    const detail = await data(await accounts.GET(request('GET', 'accounts', fixture.jointAccount.account_id), context(fixture.jointAccount.account_id)));
    assert.equal(detail.status, 'FROZEN'); assert.equal(detail.mandate.mandateType, 'ANY_ONE'); assert.equal(detail.mandate.requiredSignatories, 1);
    assert.ok(detail.branchName && detail.branchCode && detail.openedByAgentName && detail.interestRate);
    await data(await patchAccount({ status: 'ACTIVE', mandate: { type: 'ALL_HOLDERS', effectiveFrom: '2026-01-01', effectiveTo: '2027-01-01' } }));
    const mandate = (await client.query('SELECT mandate_type,required_signatories,mandate_id FROM joint_mandate WHERE account_id=$1', [fixture.jointAccount.account_id])).rows[0];
    assert.equal(mandate.required_signatories, 2);
    const audit = (await client.query("SELECT user_id FROM audit_log WHERE entity_type='joint_mandate' AND entity_id=$1 ORDER BY logged_at DESC LIMIT 1", [mandate.mandate_id])).rows[0];
    assert.equal(audit.user_id, fixture.managerId);
    const afterState = await financialSnapshot(client); assert.equal(afterState.ledger, before.ledger); assert.deepEqual(afterState.balances, before.balances); assert.deepEqual(afterState.deposits, before.deposits);
  });
  test('account edit cannot bypass role/scope/CSRF, alter money or close/reopen records', async () => {
    for (const [body, role, id, expected, csrfValid] of [
      [{ status: 'FROZEN' }, 'agent', fixture.jointAccount.account_id, 403, true], [{ status: 'FROZEN' }, 'central', fixture.jointAccount.account_id, 403, true],
      [{ status: 'FROZEN' }, 'otherManager', fixture.jointAccount.account_id, 404, true], [{ status: 'FROZEN' }, 'manager', fixture.jointAccount.account_id, 403, false],
      [{ status: 'CLOSED' }, 'manager', fixture.jointAccount.account_id, 400, true], [{ currentBalance: '9999.99' }, 'manager', fixture.jointAccount.account_id, 400, true],
      [{ mandate: { type: 'ALL_HOLDERS', effectiveFrom: '2026-02-30', effectiveTo: null } }, 'manager', fixture.jointAccount.account_id, 400, true],
      [{ mandate: { type: 'ALL_HOLDERS', effectiveFrom: '2026-02-02', effectiveTo: '2026-01-01' } }, 'manager', fixture.jointAccount.account_id, 400, true],
      [{ mandate: { type: 'ANY_ONE', effectiveFrom: '2026-01-01', effectiveTo: null } }, 'manager', fixture.ownAccount.account_id, 409, true],
    ]) assert.equal((await patchAccount(body, role, id, csrfValid)).status, expected);
    const closed = await fixture.account([fixture.customerId]);
    await client.query("UPDATE account SET current_balance=0,status='CLOSED' WHERE account_id=$1", [closed.account_id]);
    assert.equal((await patchAccount({ status: 'ACTIVE' }, 'manager', closed.account_id)).status, 409);
  });
  test('a later mandate audit failure rolls back status, mandate and all audit effects', async () => {
    const beforeState = await financialSnapshot(client);
    const old = (await client.query('SELECT to_jsonb(m) AS value FROM joint_mandate m WHERE account_id=$1', [fixture.jointAccount.account_id])).rows[0].value;
    await client.query(`CREATE FUNCTION test_record_audit_failure() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN IF NEW.entity_type='joint_mandate' THEN RAISE EXCEPTION 'Synthetic audit failure' USING ERRCODE='XX000'; END IF; RETURN NEW; END $$`);
    await client.query('CREATE TRIGGER test_record_audit_failure BEFORE INSERT ON audit_log FOR EACH ROW EXECUTE FUNCTION test_record_audit_failure()');
    try {
      const response = await patchAccount({ status: 'FROZEN', mandate: { type: 'ANY_ONE', effectiveFrom: '2026-01-01', effectiveTo: null } });
      assert.equal(response.status, 500); assert.doesNotMatch(await response.text(), /Synthetic|SELECT|UPDATE|SQL/);
      assert.deepEqual(await financialSnapshot(client), beforeState);
      assert.deepEqual((await client.query('SELECT to_jsonb(m) AS value FROM joint_mandate m WHERE account_id=$1', [fixture.jointAccount.account_id])).rows[0].value, old);
    } finally { await client.query('DROP TRIGGER test_record_audit_failure ON audit_log'); await client.query('DROP FUNCTION test_record_audit_failure()'); }
  });
});
