import { after, before, beforeEach, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { actor, counts, createFixture, pool, registrationInput, requireDisposableDatabase } from '../helpers/customer-registration.mjs';
const { registerCustomer, searchCustomers, getCustomerProfile } = await import('../../services/customer-service.ts');
const { errorResponse } = await import('../../lib/http/error-response.ts');

describe('P02-M02-T04: customer registration and scoped read service contracts', () => {
  let client;
  let fixture;
  before(async () => { client = await pool.connect(); await requireDisposableDatabase(client); });
  beforeEach(async () => {
    await client.query('BEGIN');
    try { fixture = await createFixture(client); await client.query('COMMIT'); }
    catch (error) { await client.query('ROLLBACK'); throw error; }
  });
  after(async () => { client?.release(); await pool.end(); });

  function manager() { return actor(fixture, 'BRANCH_MANAGER', fixture.managerId); }
  async function bankWide(roleName = 'AUDITOR') { return actor(fixture, roleName, await fixture.staff(roleName), null); }
  async function create(overrides = {}, caller = actor(fixture)) {
    const input = registrationInput(fixture, overrides);
    return { input, ...await registerCustomer(input, caller) };
  }
  async function mustFailWithoutEffects(operation, code) {
    const original = await counts(client);
    await assert.rejects(operation, { code });
    assert.deepEqual(await counts(client), original);
  }
  test('agent creates an independent customer without credentials and audit omits sensitive fields', async () => {
    const input = registrationInput(fixture, { fullName: ' Synthetic Customer ', email: '  SYNTHETIC@EXAMPLE.INVALID  ', nicPassportNo: ' p00123456 ' });
    const created = await registerCustomer(input, actor(fixture));
    assert.match(created.customerNumber, /^CUS-[0-9A-F]{24}$/);
    const rows = await client.query('SELECT app_user_id, nic_passport_no, email, full_name FROM customer WHERE customer_id = $1', [created.customerId]);
    assert.deepEqual(rows.rows[0], { app_user_id: null, nic_passport_no: 'P00123456', email: 'synthetic@example.invalid', full_name: 'Synthetic Customer' });
    const audit = await client.query('SELECT user_id, actor_type, old_values, new_values FROM audit_log WHERE entity_id = $1', [created.customerId]);
    assert.equal(audit.rows.length, 1);
    assert.equal(audit.rows[0].user_id, fixture.agentId);
    assert.equal(audit.rows[0].actor_type, 'USER');
    assert.equal(audit.rows[0].old_values, null);
    assert.equal(audit.rows[0].new_values.customer_number, created.customerNumber);
    assert.equal(audit.rows[0].new_values.branch_id, fixture.branchId);
    assert.equal(audit.rows[0].new_values.nic_passport_no, '****3456');
    assert.equal(audit.rows[0].new_values.email, 's***@***');
    assert.ok(!JSON.stringify(audit.rows[0]).includes('synthetic@example.invalid'));
  });
  test('manager chooses an active ordinary agent in own branch', async () => {
    const created = await create({ agentId: fixture.secondAgentId }, manager());
    const assigned = await client.query('SELECT agent_id FROM customer_agent WHERE customer_id = $1 AND is_active', [created.customerId]);
    assert.equal(assigned.rows[0].agent_id, fixture.secondAgentId);
  });
  test('registration permits no documents without claiming account-opening eligibility', async () => {
    const created = await create({ documents: [] });
    const profile = await getCustomerProfile(created.customerId, actor(fixture));
    assert.deepEqual(profile.documents, []);
    assert.equal(profile.assignmentHistory.length, 1);
  });
  test('duplicate normalized NIC returns safe 409 and has no partial effects', async () => {
    const first = await create();
    const input = registrationInput(fixture, { nicPassportNo: first.input.nicPassportNo.toLowerCase() });
    const baseline = await counts(client);
    try { await registerCustomer(input, actor(fixture)); assert.fail('Duplicate must fail.'); }
    catch (error) {
      assert.equal(error.code, 'DUPLICATE_IDENTITY');
      const response = errorResponse(error);
      assert.equal(response.status, 409);
      assert.deepEqual(await response.json(), { error: { code: 'DUPLICATE_IDENTITY', message: 'A customer with this identity already exists.' } });
    }
    assert.deepEqual(await counts(client), baseline);
  });
  test('duplicate normalized email returns 409 and rolls back', async () => {
    const first = await create();
    const input = registrationInput(fixture, { email: first.input.email.toUpperCase() });
    await mustFailWithoutEffects(() => registerCustomer(input, actor(fixture)), 'DUPLICATE_EMAIL');
  });
  test('concurrent duplicate registration commits exactly one complete customer', async () => {
    const input = registrationInput(fixture);
    const baseline = await counts(client);
    const results = await Promise.allSettled([registerCustomer(input, actor(fixture)), registerCustomer(input, actor(fixture))]);
    assert.equal(results.filter(result => result.status === 'fulfilled').length, 1);
    assert.equal(results.filter(result => result.status === 'rejected').length, 1);
    assert.equal(results.find(result => result.status === 'rejected').reason.code, 'DUPLICATE_IDENTITY');
    assert.deepEqual(await counts(client), { customers: baseline.customers + 1, documents: baseline.documents + 2,
      assignments: baseline.assignments + 1, audits: baseline.audits + 1 });
  });
  test('parallel independent registrations generate unique customer numbers', async () => {
    const results = await Promise.all(Array.from({ length: 8 }, () => registerCustomer(registrationInput(fixture), actor(fixture))));
    assert.equal(new Set(results.map(result => result.customerNumber)).size, 8);
    assert.equal(new Set(results.map(result => result.customerId)).size, 8);
  });
  test('agent cannot register into another branch', async () => {
    await mustFailWithoutEffects(() => registerCustomer(registrationInput(fixture, { branchId: fixture.otherBranchId }), actor(fixture)), 'NOT_AUTHORIZED');
  });
  test('agent cannot assign new customer to another agent', async () => {
    await mustFailWithoutEffects(() => registerCustomer(registrationInput(fixture, { agentId: fixture.secondAgentId }), actor(fixture)), 'NOT_AUTHORIZED');
  });
  test('manager cannot choose a cross-branch or missing agent', async () => {
    const crossBranchAgent = await fixture.staff('AGENT', fixture.otherBranchId);
    for (const agentId of [crossBranchAgent, randomUUID()]) {
      await mustFailWithoutEffects(() => registerCustomer(registrationInput(fixture, { agentId }), manager()), 'INVALID_ASSIGNED_AGENT');
    }
  });
  test('manager profile is not an ordinary assigned agent', async () => {
    await mustFailWithoutEffects(() => registerCustomer(registrationInput(fixture, { agentId: fixture.managerId }), manager()), 'INVALID_ASSIGNED_AGENT');
  });
  test('inactive selected agent is rejected', async () => {
    await client.query("UPDATE agent SET status = 'INACTIVE' WHERE agent_id = $1", [fixture.secondAgentId]);
    await mustFailWithoutEffects(() => registerCustomer(registrationInput(fixture, { agentId: fixture.secondAgentId }), manager()), 'INVALID_ASSIGNED_AGENT');
  });
  test('inactive selected login is rejected', async () => {
    await client.query("UPDATE app_user SET status = 'INACTIVE' WHERE user_id = $1", [fixture.secondAgentId]);
    await mustFailWithoutEffects(() => registerCustomer(registrationInput(fixture, { agentId: fixture.secondAgentId }), manager()), 'INVALID_ASSIGNED_AGENT');
  });
  test('inactive actor login and profile fail closed', async () => {
    await client.query("UPDATE app_user SET status = 'INACTIVE' WHERE user_id = $1", [fixture.agentId]);
    await mustFailWithoutEffects(() => registerCustomer(registrationInput(fixture), actor(fixture)), 'NOT_AUTHORIZED');
    await client.query("UPDATE app_user SET status = 'ACTIVE' WHERE user_id = $1", [fixture.agentId]);
    await client.query("UPDATE agent SET status = 'INACTIVE' WHERE agent_id = $1", [fixture.agentId]);
    await mustFailWithoutEffects(() => registerCustomer(registrationInput(fixture), actor(fixture)), 'NOT_AUTHORIZED');
  });
  test('null or stale actor branch cannot grant wider scope', async () => {
    for (const branchId of [null, fixture.otherBranchId]) {
      await mustFailWithoutEffects(() => registerCustomer(registrationInput(fixture), actor(fixture, 'AGENT', fixture.agentId, branchId)), 'NOT_AUTHORIZED');
    }
  });
  test('spoofing actor role does not change stored permissions', async () => {
    await mustFailWithoutEffects(() => registerCustomer(registrationInput(fixture), actor(fixture, 'BRANCH_MANAGER')), 'NOT_AUTHORIZED');
  });
  for (const role of ['ADMIN', 'CENTRAL_OPS', 'AUDITOR', 'CUSTOMER']) {
    test(`${role} cannot register under the customer mutation contract`, async () => {
      const caller = role === 'CUSTOMER' ? actor(fixture, role, fixture.customerLoginId, null) : await bankWide(role);
      await mustFailWithoutEffects(() => registerCustomer(registrationInput(fixture), caller), 'NOT_AUTHORIZED');
    });
  }
  for (const [label, overrides] of [
    ['malformed identity', { nicPassportNo: "'; DROP TABLE customer;--" }],
    ['invalid email', { email: 'not-an-email' }],
    ['invalid calendar day', { dateOfBirth: '2000-02-30' }],
    ['malformed branch ID', { branchId: 'invalid' }],
    ['empty name', { fullName: ' ' }],
    ['overlength path', { documents: [{ docType: 'NIC', filePath: 'x'.repeat(501) }] }],
    ['client verification fields', { documents: [{ docType: 'NIC', filePath: 'synthetic/x', verifiedBy: randomUUID() }] }],
    ['client login/status fields', { appUserId: randomUUID(), status: 'ACTIVE' }],
  ]) {
    test(`${label} fails strict server validation without writes`, async () => {
      await mustFailWithoutEffects(() => registerCustomer(registrationInput(fixture, overrides), actor(fixture)), 'VALIDATION_FAILED');
    });
  }
  test('today and future birth dates are rejected against database date', async () => {
    const dates = await client.query('SELECT CURRENT_DATE::text AS today, (CURRENT_DATE + 1)::text AS tomorrow');
    for (const dateOfBirth of Object.values(dates.rows[0])) {
      await mustFailWithoutEffects(() => registerCustomer(registrationInput(fixture, { dateOfBirth }), actor(fixture)), 'VALIDATION_FAILED');
    }
  });
  test('SQL payload in name is stored as text and cannot affect other rows', async () => {
    const fullName = "Synthetic'; DROP TABLE customer;--";
    const created = await create({ fullName });
    const profile = await getCustomerProfile(created.customerId, actor(fixture));
    assert.equal(profile.customer.fullName, fullName);
    assert.ok((await counts(client)).customers > 0);
  });
  test('agent search shows only current assigned customers and masks identity/email', async () => {
    const visible = await create();
    await create({ agentId: fixture.secondAgentId }, manager());
    const result = await searchCustomers({ branchId: fixture.branchId }, actor(fixture));
    assert.equal(result.total, 1);
    assert.equal(result.customers[0].customerId, visible.customerId);
    assert.equal(result.customers[0].nicPassportNo, `***${visible.input.nicPassportNo.slice(-4)}`);
    assert.equal(result.customers[0].email, '***@***');
  });
  test('manager search includes own branch only and masks identity', async () => {
    const visible = await create();
    const otherActor = actor(fixture, 'AGENT', await fixture.staff('AGENT', fixture.otherBranchId), fixture.otherBranchId);
    await create({ branchId: fixture.otherBranchId, agentId: otherActor.userId }, otherActor);
    const result = await searchCustomers({ q: visible.customerNumber }, manager());
    assert.equal(result.total, 1);
    assert.equal(result.customers[0].customerId, visible.customerId);
    assert.equal(result.customers[0].nicPassportNo, `***${visible.input.nicPassportNo.slice(-4)}`);
    await assert.rejects(() => searchCustomers({ branchId: fixture.otherBranchId }, manager()), { code: 'NOT_AUTHORIZED' });
  });
  test('bank-wide authorized roles can read full identity and filter branch/agent', async () => {
    const created = await create();
    for (const role of ['CENTRAL_OPS', 'AUDITOR']) {
      const result = await searchCustomers({ branchId: fixture.branchId, agentId: fixture.agentId }, await bankWide(role));
      assert.equal(result.total, 1);
      assert.equal(result.customers[0].nicPassportNo, created.input.nicPassportNo);
      assert.equal(result.customers[0].email, created.input.email);
    }
  });
  test('name, identity, reference and status filters return matching rows', async () => {
    const created = await create({ fullName: 'Synthetic Malini Perera' });
    const calls = [{ name: 'mALINi' }, { nicPassportNo: created.input.nicPassportNo.toLowerCase() },
      { q: created.customerNumber }, { q: 'Perera', status: 'ACTIVE' }];
    for (const filters of calls) {
      const result = await searchCustomers(filters, actor(fixture));
      assert.equal(result.total, 1);
      assert.equal(result.customers[0].customerId, created.customerId);
    }
    await client.query("UPDATE customer SET status = 'INACTIVE' WHERE customer_id = $1", [created.customerId]);
    assert.equal((await searchCustomers({ status: 'ACTIVE' }, actor(fixture))).total, 0);
    assert.equal((await searchCustomers({ status: 'INACTIVE' }, actor(fixture))).total, 1);
  });
  test('pagination preserves totals even when requested page is empty', async () => {
    for (const fullName of ['Synthetic Charlie', 'Synthetic Alpha', 'Synthetic Beta']) await create({ fullName });
    const caller = actor(fixture);
    const first = await searchCustomers({ pageSize: 2 }, caller);
    const second = await searchCustomers({ pageSize: 2, page: 2 }, caller);
    const empty = await searchCustomers({ pageSize: 2, page: 99 }, caller);
    assert.deepEqual(first.customers.map(customer => customer.fullName), ['Synthetic Alpha', 'Synthetic Beta']);
    assert.deepEqual(second.customers.map(customer => customer.fullName), ['Synthetic Charlie']);
    assert.deepEqual(empty.customers, []);
    assert.equal(first.total, 3); assert.equal(second.total, 3); assert.equal(empty.total, 3);
    const descending = await searchCustomers({ sortDirection: 'desc' }, caller);
    assert.deepEqual(descending.customers.map(customer => customer.fullName), ['Synthetic Charlie', 'Synthetic Beta', 'Synthetic Alpha']);
  });
  test('sort identifiers, page limits and SQL injection are rejected or treated as literals', async () => {
    await create({ fullName: 'Synthetic Percentage%_Name' });
    for (const search of [{ sortBy: 'full_name; DROP TABLE customer' }, { sortDirection: 'desc;--' }, { page: 0 }, { pageSize: 101 }]) {
      await assert.rejects(() => searchCustomers(search, actor(fixture)), { code: 'VALIDATION_FAILED' });
    }
    assert.equal((await searchCustomers({ q: "' OR 1=1 --" }, actor(fixture))).total, 0);
    assert.equal((await searchCustomers({ q: '%_' }, actor(fixture))).total, 1);
  });
  test('profile returns all assignment history and safe document metadata', async () => {
    const created = await create();
    await client.query("UPDATE customer_agent SET is_active = false, end_date = CURRENT_DATE WHERE customer_id = $1", [created.customerId]);
    await fixture.assignment({ customer_id: created.customerId, agent_id: fixture.secondAgentId });
    const profile = await getCustomerProfile(created.customerId, manager());
    assert.equal(profile.assignmentHistory.length, 2);
    assert.equal(profile.assignmentHistory.filter(row => row.isActive).length, 1);
    assert.equal(profile.documents.length, 2);
    assert.ok(profile.documents.every(row => !('filePath' in row) && row.verifiedBy === null));
    assert.deepEqual(profile.accounts, [], 'The merged holder relation has no accounts for this customer.');
    await assert.rejects(() => getCustomerProfile(created.customerId, actor(fixture)), { code: 'NOT_FOUND' });
  });
  test('another branch and missing profile use safe not-found responses', async () => {
    const created = await create();
    const otherManager = actor(fixture, 'BRANCH_MANAGER', fixture.otherManagerId, fixture.otherBranchId);
    await assert.rejects(() => getCustomerProfile(created.customerId, otherManager), { code: 'NOT_FOUND' });
    await assert.rejects(() => getCustomerProfile(randomUUID(), manager()), { code: 'NOT_FOUND' });
    await assert.rejects(() => getCustomerProfile('invalid', manager()), { code: 'VALIDATION_FAILED' });
  });
  test('optional customer login can read only its linked profile with full own identity', async () => {
    const own = await create();
    const other = await create();
    await client.query('UPDATE customer SET app_user_id = $1 WHERE customer_id = $2', [fixture.customerLoginId, own.customerId]);
    const caller = actor(fixture, 'CUSTOMER', fixture.customerLoginId, null);
    const profile = await getCustomerProfile(own.customerId, caller);
    assert.equal(profile.customer.nicPassportNo, own.input.nicPassportNo);
    assert.equal(profile.customer.email, own.input.email);
    await assert.rejects(() => getCustomerProfile(other.customerId, caller), { code: 'NOT_FOUND' });
    await assert.rejects(() => searchCustomers({}, caller), { code: 'NOT_AUTHORIZED' });
  });
  test('revoked actor state is rechecked for reads as well as writes', async () => {
    const created = await create();
    await client.query("UPDATE app_user SET status = 'INACTIVE' WHERE user_id = $1", [fixture.agentId]);
    await assert.rejects(() => searchCustomers({}, actor(fixture)), { code: 'NOT_AUTHORIZED' });
    await assert.rejects(() => getCustomerProfile(created.customerId, actor(fixture)), { code: 'NOT_AUTHORIZED' });
  });
  test('merged runtime grants retain read-only role access and prohibit customer deletion', async () => {
    const result = await client.query("SELECT has_table_privilege('mims_app', 'customer', 'SELECT') AS read, has_table_privilege('mims_app', 'customer', 'INSERT') AS write");
    assert.deepEqual(result.rows[0], { read: true, write: true });
    const restricted = await client.query("SELECT has_table_privilege('mims_app', 'role', 'UPDATE') AS role_update, has_table_privilege('mims_app', 'customer', 'DELETE') AS customer_delete");
    assert.deepEqual(restricted.rows[0], { role_update: false, customer_delete: false });
  });
  test('holder read contract preserves money strings and filters account branch', async () => {
    const created = await create();
    // Exercise M3's merged relation without replacing or dropping its schema.
    const accounts = [];
    try {
      for (const branchId of [fixture.branchId, fixture.otherBranchId]) {
        const result = await client.query(
          `INSERT INTO account (plan_id, branch_id, opened_by_agent_id, account_number, current_balance)
           SELECT plan_id, $1, $2, $3, 1234.56 FROM savings_plan WHERE plan_name = 'Adult' RETURNING account_id`,
          [branchId, fixture.agentId, `SYNTHETIC-${randomUUID()}`],
        );
        assert.ok(result.rows[0], 'Seeded Adult plan is required for account contract test.');
        accounts.push(result.rows[0].account_id);
        await client.query('INSERT INTO account_holder (account_id, customer_id) VALUES ($1,$2)', [accounts.at(-1), created.customerId]);
      }
      const scoped = await getCustomerProfile(created.customerId, manager());
      assert.equal(scoped.accounts.length, 1);
      assert.equal(scoped.accounts[0].accountId, accounts[0]);
      assert.equal(scoped.accounts[0].currentBalance, '1234.56');
      const wide = await getCustomerProfile(created.customerId, await bankWide());
      assert.equal(wide.accounts.length, 2);
      assert.ok(wide.accounts.every(account => typeof account.currentBalance === 'string'));
    } finally {
      await client.query('DELETE FROM account_holder WHERE account_id = ANY($1::uuid[])', [accounts]);
      await client.query('DELETE FROM account WHERE account_id = ANY($1::uuid[])', [accounts]);
    }
  });
  test('application role executes services using migrated grants and RLS', async () => {
    const originalConnect = pool.connect;
    const cleanups = [];
    pool.connect = async () => {
      const connection = await originalConnect.call(pool);
      const release = connection.release.bind(connection);
      try { await connection.query('SET ROLE mims_app'); }
      catch (error) { release(); throw error; }
      connection.release = () => {
        cleanups.push(connection.query('RESET ROLE').finally(() => { connection.release = release; release(); }));
      };
      return connection;
    };
    try {
      const privileges = await client.query("SELECT has_table_privilege('mims_app', 'role', 'UPDATE') AS can_update_role");
      assert.equal(privileges.rows[0].can_update_role, false);
      const input = registrationInput(fixture);
      const result = await registerCustomer(input, actor(fixture));
      const profile = await getCustomerProfile(result.customerId, actor(fixture));
      assert.equal(profile.customer.customerId, result.customerId);
      assert.equal((await searchCustomers({ q: result.customerNumber }, actor(fixture))).total, 1);
    } finally {
      pool.connect = originalConnect;
      await Promise.all(cleanups);
    }
  });
});
