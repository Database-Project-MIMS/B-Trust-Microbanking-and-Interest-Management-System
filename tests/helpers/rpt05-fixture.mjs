import { randomUUID } from 'node:crypto';
import { fdFixture } from './customer-fixed-deposits.mjs';

export async function rpt05Fixture(client) {
  const fixture = await fdFixture(client);
  const channel = (await client.query(
    "SELECT channel_id FROM transaction_channel WHERE channel_name = 'BRANCH_COUNTER'",
  )).rows[0].channel_id;
  async function post(accountId, type, amount, at) {
    const id = randomUUID();
    await client.query(
      `INSERT INTO transaction (
         transaction_id, account_id, initiated_by_user_id, channel_id,
         reference_number, transaction_type, amount, transaction_date
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [id, accountId, fixture.agentId, channel, `RPT05-${randomUUID()}`, type, amount, at],
    );
    return id;
  }
  await post(fixture.ownAccount.account_id, 'DEPOSIT', '100.00', '2026-09-30T18:30:00Z');
  await post(fixture.ownAccount.account_id, 'WITHDRAWAL', '30.00', '2026-10-01T10:00:00Z');
  await post(fixture.ownAccount.account_id, 'INTEREST_CREDIT', '5.00', '2026-10-01T11:00:00Z');
  const original = await post(fixture.jointAccount.account_id, 'DEPOSIT', '40.00', '2026-10-01T12:00:00Z');
  const reversal = await post(fixture.jointAccount.account_id, 'REVERSAL', '40.00', '2026-10-02T10:00:00Z');
  await client.query(
    `INSERT INTO transaction_reversal (
       original_transaction_id, reversal_transaction_id, reason, reversed_by_user_id
     ) VALUES ($1,$2,'Synthetic RPT-05 test',$3)`,
    [original, reversal, fixture.managerId],
  );
  await post(fixture.otherAccount.account_id, 'DEPOSIT', '75.00', '2026-10-01T12:00:00Z');
  return fixture;
}
