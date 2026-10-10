import { randomUUID, randomBytes, createHash } from 'node:crypto';
import { NextRequest } from 'next/server';
import { createFixture } from './customer-relations.mjs';
export { pool, requireDisposableDatabase } from './customer-relations.mjs';
export { useCustomerRuntime } from './customer-runtime.mjs';

export async function fdFixture(client) {
  const fixture = await createFixture(client);
  await fixture.assignment();
  await client.query('UPDATE customer SET app_user_id=$1 WHERE customer_id=$2', [fixture.customerLoginId, fixture.customerId]);
  const secondCustomerId = await fixture.customer();
  await fixture.assignment({ customer_id: secondCustomerId, agent_id: fixture.secondAgentId });
  const otherCustomerId = await fixture.customer(fixture.otherBranchId);
  const emptyCustomerId = await fixture.customer();
  await fixture.assignment({ customer_id: emptyCustomerId });
  const centralId = await fixture.staff('CENTRAL_OPS');
  const auditorId = await fixture.staff('AUDITOR');
  const adminId = await fixture.staff('ADMIN');
  const planId = (await client.query("SELECT fd_plan_id FROM fd_plan WHERE plan_name='6 Month FD' AND effective_to IS NULL LIMIT 1")).rows[0].fd_plan_id;
  async function account(customerIds, branchId = fixture.branchId) {
    const created = await client.query(
      `INSERT INTO account(account_number,plan_id,branch_id,opened_by_agent_id,current_balance)
       SELECT $1,plan_id,$2,$3,123456.78 FROM savings_plan WHERE plan_name=$4 RETURNING account_id,account_number`,
      [`CFD-${randomUUID()}`, branchId, fixture.agentId, customerIds.length > 1 ? 'Joint' : 'Adult'],
    );
    const row = created.rows[0];
    await client.query(
      `INSERT INTO account_holder(account_id,customer_id,holder_type)
       SELECT $1, customer_id, CASE WHEN position=1 THEN 'PRIMARY' ELSE 'JOINT' END
       FROM unnest($2::uuid[]) WITH ORDINALITY AS holders(customer_id,position)`, [row.account_id, customerIds],
    );
    return row;
  }
  const ownAccount = await account([fixture.customerId]);
  const jointAccount = await account([fixture.customerId, secondCustomerId]);
  const otherAccount = await account([otherCustomerId], fixture.otherBranchId);
  async function deposit(accountId, status='ACTIVE', principal='100000.10', date='2026-09-01') {
    const row = await client.query(
      `INSERT INTO fixed_deposit(account_id,fd_plan_id,principal_amount,interest_rate_at_opening,
         start_date,maturity_date,next_interest_date,status)
       VALUES($1,$2,$3,0.1375,$4::date,$4::date+interval '6 months',$4::date+interval '30 days',$5)
       RETURNING fd_id`, [accountId, planId, principal, date, status],
    );
    return row.rows[0].fd_id;
  }
  const activeId = await deposit(ownAccount.account_id, 'ACTIVE', '9999999999999.99', '2026-09-03');
  const maturedId = await deposit(ownAccount.account_id, 'MATURED', '1234.56', '2026-09-02');
  const closedId = await deposit(ownAccount.account_id, 'CLOSED', '0.01', '2026-09-01');
  const jointId = await deposit(jointAccount.account_id, 'ACTIVE', '200000.20', '2026-09-04');
  const otherId = await deposit(otherAccount.account_id);
  const tokens={};
  async function session(userId) {
    const token=randomBytes(32).toString('hex');
    await client.query("INSERT INTO user_session(user_id,token_hash,expires_at) VALUES($1,$2,now()+interval '1 hour')",
      [userId,createHash('sha256').update(token).digest('hex')]);
    return token;
  }
  for (const [name,id] of Object.entries({agent:fixture.agentId,second:fixture.secondAgentId,manager:fixture.managerId,
    otherManager:fixture.otherManagerId,central:centralId,auditor:auditorId,admin:adminId,customer:fixture.customerLoginId})) tokens[name]=await session(id);
  return {...fixture,secondCustomerId,otherCustomerId,emptyCustomerId,centralId,auditorId,adminId,
    planId,ownAccount,jointAccount,otherAccount,activeId,maturedId,closedId,jointId,otherId,tokens,account,deposit,session};
}

export function fdRequest(customerId,token,query='') {
  return new NextRequest(`http://localhost/api/customers/${customerId}/fixed-deposits${query}`,
    {headers:token?{cookie:`mims_session=${token}`}:{}});
}

export async function financialSnapshot(client) {
  const result=await client.query(`SELECT
    (SELECT jsonb_agg(jsonb_build_array(account_id,current_balance) ORDER BY account_id) FROM account) AS balances,
    (SELECT count(*)::int FROM transaction) AS ledger,
    (SELECT count(*)::int FROM audit_log) AS audit,
    (SELECT jsonb_agg(to_jsonb(fd) ORDER BY fd_id) FROM fixed_deposit fd) AS deposits`);
  return result.rows[0];
}
