import { randomUUID, randomBytes, createHash } from 'node:crypto';
import { NextRequest } from 'next/server';
import { createFixture, requireDisposableDatabase } from './customer-relations.mjs';
export { pool, requireDisposableDatabase } from './customer-relations.mjs';

// Committed fixtures are visible to route/service connections only in the disposable cluster.
export async function createActivityFixture(client) {
  await requireDisposableDatabase(client);
  const fixture = await createFixture(client);
  const adminId = await fixture.staff('ADMIN');
  const centralId = await fixture.staff('CENTRAL_OPS');
  const auditorId = await fixture.staff('AUDITOR');
  const otherAgentId = await fixture.staff('AGENT', fixture.otherBranchId);
  const accountId = (await client.query(
    `INSERT INTO account (account_number, plan_id, branch_id, opened_by_agent_id)
     SELECT $1, plan_id, $2, $3 FROM savings_plan WHERE plan_name = 'Children' RETURNING account_id`,
    [`ACT-${randomUUID().slice(0, 8)}`, fixture.branchId, fixture.agentId],
  )).rows[0].account_id;
  const channelId = (await client.query("SELECT channel_id FROM transaction_channel WHERE channel_name = 'SYSTEM'")).rows[0].channel_id;
  async function insert({ amount = '1.00', type = 'DEPOSIT', date = '2026-09-01T12:00:00Z',
    agentId = fixture.agentId, branchId = fixture.branchId } = {}) {
    await client.query(
      `INSERT INTO transaction (account_id, initiated_by_user_id, channel_id, reference_number,
         transaction_type, amount, transaction_date, agent_id, branch_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [accountId, adminId, channelId, `ACT-${randomUUID()}`, type, amount, date, agentId, branchId],
    );
  }
  // Expected amounts are deliberately written by hand, independently of the service SQL.
  await insert({ amount: '900.00', date: '2026-08-31T18:29:59.999999Z' });
  await insert({ amount: '0.10', date: '2026-08-31T18:30:00Z' });
  await insert({ amount: '0.20' });
  await insert({ type: 'WITHDRAWAL', amount: '1.25', date: '2026-09-01T18:29:59.999999Z' });
  await insert({ type: 'INTEREST_CREDIT', amount: '2.05' });
  await insert({ type: 'REVERSAL', amount: '3.50' });
  await insert({ amount: '4.00', date: '2026-09-01T18:30:00Z' });
  await insert({ amount: '5.00', date: '2026-09-02T12:00:00Z' });
  await insert({ amount: '99.00', date: '2026-09-02T18:30:00Z' });
  await insert({ amount: '100000.00', agentId: fixture.secondAgentId });
  await insert({ amount: '200.00', agentId: null });
  await insert({ amount: '8.00', branchId: fixture.otherBranchId });
  await insert({ amount: '16.00', branchId: null });
  const tokens = {};
  for (const [name, id] of Object.entries({ agent: fixture.agentId, second: fixture.secondAgentId,
    manager: fixture.managerId, otherManager: fixture.otherManagerId, admin: adminId,
    central: centralId, auditor: auditorId, customer: fixture.customerLoginId })) {
    const token = randomBytes(32).toString('hex');
    await client.query("INSERT INTO user_session (user_id, token_hash, expires_at) VALUES ($1,$2,now()+interval '1 hour')",
      [id, createHash('sha256').update(token).digest('hex')]);
    tokens[name] = token;
  }
  return { ...fixture, adminId, centralId, auditorId, otherAgentId, accountId, insert, tokens };
}

export function activityRequest(agentId, token, query = 'from=2026-09-01&to=2026-09-01') {
  return new NextRequest(`http://localhost/api/agents/${agentId}/activity?${query}`, {
    headers: token ? { cookie: `mims_session=${token}` } : {},
  });
}

export const branchDayTotals = [
  { type: 'DEPOSIT', count: 2, total: '0.30' },
  { type: 'INTEREST_CREDIT', count: 1, total: '2.05' },
  { type: 'REVERSAL', count: 1, total: '3.50' },
  { type: 'WITHDRAWAL', count: 1, total: '1.25' },
];
export const bankDayTotals = [{ type: 'DEPOSIT', count: 4, total: '24.30' }, ...branchDayTotals.slice(1)];
