import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { fdFixture, pool, requireDisposableDatabase } from '../helpers/customer-fixed-deposits.mjs';

describe('P06-M02-T04: existing database guards remain authoritative for record management', () => {
  let client, fixture;
  before(async () => {
    client = await pool.connect(); await requireDisposableDatabase(client); await client.query('BEGIN');
    fixture = await fdFixture(client);
    await client.query(`INSERT INTO joint_mandate(account_id,mandate_type,required_signatories) VALUES($1,'ALL_HOLDERS',2)`, [fixture.jointAccount.account_id]);
    await client.query('SET LOCAL ROLE mims_app');
    await client.query("SELECT set_config('app.current_user_id',$1,true),set_config('app.current_user_role','BRANCH_MANAGER',true),set_config('app.current_branch_id',$2,true)", [fixture.managerId, fixture.branchId]);
  });
  after(async () => { await client?.query('ROLLBACK'); client?.release(); await pool.end(); });
  async function denied(sql, params, codes) {
    await client.query('SAVEPOINT guard');
    try { await assert.rejects(client.query(sql, params), error => codes.includes(error.code)); }
    finally { await client.query('ROLLBACK TO SAVEPOINT guard'); await client.query('RELEASE SAVEPOINT guard'); }
  }
  test('runtime cannot alter FD principal, account linkage or opening rate snapshots', async () => {
    for (const sql of ['UPDATE fixed_deposit SET principal_amount=1 WHERE fd_id=$1',
      'UPDATE fixed_deposit SET interest_rate_at_opening=0.99 WHERE fd_id=$1',
      'UPDATE fixed_deposit SET account_id=account_id WHERE fd_id=$1',
      "UPDATE fixed_deposit SET start_date='2026-01-01' WHERE fd_id=$1"]) await denied(sql, [fixture.activeId], ['42501']);
  });
  test('account branch and funded closure are protected even through direct SQL', async () => {
    await denied('UPDATE account SET branch_id=$2 WHERE account_id=$1', [fixture.ownAccount.account_id, fixture.otherBranchId], ['23514']);
    await denied("UPDATE account SET status='CLOSED' WHERE account_id=$1", [fixture.ownAccount.account_id], ['P0001']);
  });
  test('invalid joint signer counts and date ranges fail below the form', async () => {
    await denied("UPDATE joint_mandate SET mandate_type='ALL_HOLDERS',required_signatories=1 WHERE account_id=$1", [fixture.jointAccount.account_id], ['P0001']);
    await denied("UPDATE joint_mandate SET mandate_type='ANY_ONE',required_signatories=2 WHERE account_id=$1", [fixture.jointAccount.account_id], ['23514']);
    await denied("UPDATE joint_mandate SET effective_from='2026-02-01',effective_to='2026-01-01' WHERE account_id=$1", [fixture.jointAccount.account_id], ['23514']);
  });
  test('direct status edit audits in the same transaction and branch RLS denies foreign account changes', async () => {
    await client.query("UPDATE account SET status='FROZEN' WHERE account_id=$1", [fixture.ownAccount.account_id]);
    const audit = (await client.query("SELECT user_id,new_values FROM audit_log WHERE entity_type='account' AND entity_id=$1 ORDER BY logged_at DESC, log_id DESC", [fixture.ownAccount.account_id])).rows;
    assert.ok(audit.some(row => row.user_id === fixture.managerId && row.new_values.status === 'FROZEN'));
    const deniedUpdate = await client.query("UPDATE account SET status='FROZEN' WHERE account_id=$1 RETURNING account_id", [fixture.otherAccount.account_id]);
    assert.equal(deniedUpdate.rowCount, 0);
  });
});
