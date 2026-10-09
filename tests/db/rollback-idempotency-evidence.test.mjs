import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import pg from 'pg';
import { NextRequest } from 'next/server';
import { withTransaction } from '../../lib/db/index.ts';
import { setRlsContext } from '../../lib/db/rls-context.ts';
import { createSession } from '../../lib/auth/session.ts';
import { POST as depositRoutePost } from '../../app/api/transactions/deposits/route.ts';

if (!process.env.DATABASE_URL) {
  try { process.loadEnvFile(); } catch { /* ignore */ }
}

const ownerUrl = process.env.DATABASE_MIGRATION_URL ?? process.env.DATABASE_URL;

/**
 * P06-M04-T01: Adversarial Rollback and Idempotency Test Harness.
 *
 * Verifies the database-first transaction integrity guarantees:
 * 1. Forced mid-transaction failure in sp_post_deposit rolls back completely:
 *    no ledger row and no account balance update survive.
 * 2. Forced mid-transaction failure in sp_post_withdrawal rolls back completely:
 *    no ledger row and no debit survive.
 * 3. Forced mid-transaction failure in sp_reverse_transaction rolls back completely:
 *    neither the reversal link nor an orphaned compensating ledger row survives.
 * 4. Idempotency replay across HTTP round-trip returns the original transaction
 *    and credits the balance exactly once.
 * 5. Reusing an idempotency key with an altered payload fails safely without side effects.
 * 6. An aborted transaction before commit releases the idempotency key for successful retry.
 */
test('P06-M04-T01: Rollback & Idempotency Evidence (Adversarial Fault Injection)', async (t) => {
  const ownerClient = new pg.Client({ connectionString: ownerUrl });
  await ownerClient.connect();

  let adminUserId, agentUserId, branchId, channelId;
  let savedBusinessStart, savedBusinessEnd;

  try {
    // Ensure 24-hour business hours for predictable test execution
    const startRes = await ownerClient.query(`SELECT param_value FROM system_parameter WHERE param_key = 'BUSINESS_HOUR_START'`);
    const endRes = await ownerClient.query(`SELECT param_value FROM system_parameter WHERE param_key = 'BUSINESS_HOUR_END'`);
    savedBusinessStart = startRes.rows[0]?.param_value || '08:30';
    savedBusinessEnd = endRes.rows[0]?.param_value || '17:00';

    await ownerClient.query(`UPDATE system_parameter SET param_value = '00:00' WHERE param_key = 'BUSINESS_HOUR_START'`);
    await ownerClient.query(`UPDATE system_parameter SET param_value = '23:59:59' WHERE param_key = 'BUSINESS_HOUR_END'`);

    // Ensure today is marked as a business day in business_calendar
    await ownerClient.query(`
      INSERT INTO business_calendar (calendar_date, is_business_day)
      VALUES (CURRENT_DATE, true)
      ON CONFLICT (calendar_date) DO UPDATE SET is_business_day = true
    `);

    // Fetch existing seeded roles and channels
    const adminRes = await ownerClient.query(`
      SELECT u.user_id FROM app_user u
      JOIN role r ON r.role_id = u.role_id
      WHERE r.role_name = 'ADMIN' AND u.status = 'ACTIVE' LIMIT 1
    `);
    adminUserId = adminRes.rows[0]?.user_id;

    const agentRes = await ownerClient.query(`
      SELECT a.agent_id, a.branch_id FROM agent a
      JOIN app_user u ON u.user_id = a.agent_id
      JOIN role r ON r.role_id = u.role_id
      WHERE a.status = 'ACTIVE' AND r.role_name = 'AGENT' LIMIT 1
    `);
    agentUserId = agentRes.rows[0]?.agent_id;
    branchId = agentRes.rows[0]?.branch_id;

    const channelRes = await ownerClient.query(`
      SELECT channel_id FROM transaction_channel WHERE channel_name = 'BRANCH_COUNTER' LIMIT 1
    `);
    channelId = channelRes.rows[0]?.channel_id;

    assert.ok(adminUserId, 'Active admin user required for test setup.');
    assert.ok(agentUserId, 'Active agent user required for test setup.');
    assert.ok(channelId, 'BRANCH_COUNTER channel required for test setup.');

    // Helper to create an active test customer and savings account using ownerClient
    async function createTestAccount(initialBalance = '1000.00', customNumberPrefix = 'ACC-EVID') {
      const planRes = await ownerClient.query(`SELECT plan_id FROM savings_plan WHERE max_holders >= 1 LIMIT 1`);
      const planId = planRes.rows[0].plan_id;

      const suffix = randomUUID().slice(0, 8);
      const custRes = await ownerClient.query(`
        INSERT INTO customer (customer_number, nic_passport_no, email, full_name, date_of_birth, address, branch_id)
        VALUES ($1, $2, $3, 'Evidence Test Customer', '1992-05-10', '100 Evidence Way', $4)
        RETURNING customer_id
      `, [`CUS-${suffix}`, `NIC-${suffix}`, `cust-${suffix}@evidence.test`, branchId]);
      const customerId = custRes.rows[0].customer_id;

      const accNumber = `${customNumberPrefix}-${suffix}`;
      const accRes = await ownerClient.query(`
        INSERT INTO account (account_number, plan_id, branch_id, opened_by_agent_id, status, current_balance)
        VALUES ($1, $2, $3, $4, 'ACTIVE', $5)
        RETURNING account_id, account_number, current_balance
      `, [accNumber, planId, branchId, agentUserId, initialBalance]);
      const accountId = accRes.rows[0].account_id;

      await ownerClient.query(`
        INSERT INTO account_holder (account_id, customer_id, holder_type)
        VALUES ($1, $2, 'PRIMARY')
      `, [accountId, customerId]);

      await ownerClient.query(`
        INSERT INTO customer_agent (customer_id, agent_id, assigned_date, is_active)
        VALUES ($1, $2, CURRENT_DATE, true)
        ON CONFLICT DO NOTHING
      `, [customerId, agentUserId]);

      return { accountId, customerId, accountNumber: accNumber, initialBalance };
    }

    await t.test('1. Forced mid-transaction failure in sp_post_deposit: no ledger row and no balance delta survive', async () => {
      const { accountId, accountNumber } = await createTestAccount('1000.00', 'FAIL-DEP');

      // Create an adversarial trigger (as owner) that injects a failure on UPDATE account
      // (after the ledger row has already been inserted in Step 5 of sp_post_deposit)
      await ownerClient.query(`
        CREATE OR REPLACE FUNCTION trg_inject_deposit_error() RETURNS trigger AS $$
        BEGIN
          IF NEW.account_number = '${accountNumber}' THEN
            RAISE EXCEPTION 'TEST_INJECTED_DEPOSIT_FAILURE' USING ERRCODE = 'P0001';
          END IF;
          RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;

        DROP TRIGGER IF EXISTS trg_test_deposit_fault ON account;
        CREATE TRIGGER trg_test_deposit_fault
          BEFORE UPDATE ON account
          FOR EACH ROW EXECUTE FUNCTION trg_inject_deposit_error();
      `);

      try {
        // Attempt deposit as application role
        await assert.rejects(
          async () => {
            await withTransaction(async (tx) => {
              await setRlsContext(tx, { userId: agentUserId, branchId, roleName: 'AGENT' });
              await tx.query(`
                CALL sp_post_deposit($1, $2, $3, $4, $5, $6, NULL, NULL, NULL, NULL)
              `, [accountId, '500.00', channelId, agentUserId, `IDEM-FAIL-${randomUUID()}`, 'Adversarial Deposit']);
            });
          },
          (err) => {
            return err.message?.includes('TEST_INJECTED_DEPOSIT_FAILURE') ||
                   err.code === 'UNEXPECTED_DB_ERROR' ||
                   err.sqlstate === 'P0001';
          },
          'Expected sp_post_deposit to abort due to injected mid-transaction failure'
        );

        // Verify ATOMICITY using ownerClient to bypass RLS and see absolute ground truth
        const accRows = await ownerClient.query(`SELECT current_balance FROM account WHERE account_id = $1`, [accountId]);
        assert.equal(Number(accRows.rows[0].current_balance), 1000.00, 'Account balance must remain exactly 1000.00');

        const txCountRows = await ownerClient.query(`SELECT COUNT(*) AS cnt FROM transaction WHERE account_id = $1`, [accountId]);
        assert.equal(Number(txCountRows.rows[0].cnt), 0, 'Ledger transaction row must NOT survive');

        const auditRows = await ownerClient.query(`
          SELECT COUNT(*) AS cnt FROM audit_log
          WHERE entity_type = 'transaction' AND (new_values->>'account_id')::uuid = $1
        `, [accountId]);
        assert.equal(Number(auditRows.rows[0].cnt), 0, 'No audit log row for rolled-back transaction must survive');
      } finally {
        await ownerClient.query(`
          DROP TRIGGER IF EXISTS trg_test_deposit_fault ON account;
          DROP FUNCTION IF EXISTS trg_inject_deposit_error();
        `);
      }
    });

    await t.test('2. Forced mid-transaction failure in sp_post_withdrawal: zero partial debit and zero ledger row', async () => {
      const { accountId, customerId } = await createTestAccount('2000.00', 'FAIL-WD');

      // Create an adversarial trigger on audit_log that aborts the transaction
      // after the ledger insert and balance update have occurred
      await ownerClient.query(`
        CREATE OR REPLACE FUNCTION trg_inject_withdrawal_error() RETURNS trigger AS $$
        BEGIN
          IF NEW.action = 'WITHDRAWAL' AND (NEW.new_values->>'account_id')::uuid = '${accountId}' THEN
            RAISE EXCEPTION 'TEST_INJECTED_WITHDRAWAL_FAILURE' USING ERRCODE = 'P0001';
          END IF;
          RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;

        DROP TRIGGER IF EXISTS trg_test_withdrawal_fault ON audit_log;
        CREATE TRIGGER trg_test_withdrawal_fault
          BEFORE INSERT ON audit_log
          FOR EACH ROW EXECUTE FUNCTION trg_inject_withdrawal_error();
      `);

      try {
        await assert.rejects(
          async () => {
            await withTransaction(async (tx) => {
              await setRlsContext(tx, { userId: adminUserId, branchId: null, roleName: 'ADMIN' });
              await tx.query(`
                CALL sp_post_withdrawal($1, $2, $3, $4, $5::uuid[], $6, $7, NULL, NULL, NULL, NULL)
              `, [accountId, '750.00', channelId, adminUserId, [customerId], `IDEM-FAIL-WD-${randomUUID()}`, 'Fault Withdrawal']);
            });
          },
          (err) => {
            return err.message?.includes('TEST_INJECTED_WITHDRAWAL_FAILURE') ||
                   err.code === 'UNEXPECTED_DB_ERROR' ||
                   err.sqlstate === 'P0001';
          },
          'Expected sp_post_withdrawal to abort due to injected mid-transaction failure'
        );

        // Verify ATOMICITY
        const accRows = await ownerClient.query(`SELECT current_balance FROM account WHERE account_id = $1`, [accountId]);
        assert.equal(Number(accRows.rows[0].current_balance), 2000.00, 'Account balance must remain 2000.00 (not debited by 750)');

        const txCountRows = await ownerClient.query(`SELECT COUNT(*) AS cnt FROM transaction WHERE account_id = $1`, [accountId]);
        assert.equal(Number(txCountRows.rows[0].cnt), 0, 'No partial withdrawal ledger row must survive');
      } finally {
        await ownerClient.query(`
          DROP TRIGGER IF EXISTS trg_test_withdrawal_fault ON audit_log;
          DROP FUNCTION IF EXISTS trg_inject_withdrawal_error();
        `);
      }
    });

    await t.test('3. Forced mid-transaction failure in sp_reverse_transaction: no orphaned compensating ledger entry', async () => {
      const { accountId } = await createTestAccount('5000.00', 'FAIL-REV');

      // First post a legitimate deposit of 1000.00 -> balance becomes 6000.00
      const depRes = await withTransaction(async (tx) => {
        await setRlsContext(tx, { userId: agentUserId, branchId, roleName: 'AGENT' });
        const res = await tx.query(`
          CALL sp_post_deposit($1, $2, $3, $4, $5, $6, NULL, NULL, NULL, NULL)
        `, [accountId, '1000.00', channelId, agentUserId, `IDEM-FOR-REV-${randomUUID()}`, 'Deposit for Reversal']);
        return res.rows[0];
      });
      const originalTransactionId = depRes.p_transaction_id;
      assert.ok(originalTransactionId, 'Original deposit transaction must exist');

      const balAfterDeposit = (await ownerClient.query(`SELECT current_balance FROM account WHERE account_id = $1`, [accountId])).rows[0].current_balance;
      assert.equal(Number(balAfterDeposit), 6000.00);

      // Inject failure on transaction_reversal INSERT:
      // (Compensating REVERSAL transaction was inserted in Step 4; Step 6 inserts transaction_reversal)
      await ownerClient.query(`
        CREATE OR REPLACE FUNCTION trg_inject_reversal_error() RETURNS trigger AS $$
        BEGIN
          IF NEW.reason = 'FORCE_MID_REVERSAL_FAILURE' THEN
            RAISE EXCEPTION 'TEST_INJECTED_REVERSAL_FAILURE' USING ERRCODE = 'P0001';
          END IF;
          RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;

        DROP TRIGGER IF EXISTS trg_test_reversal_fault ON transaction_reversal;
        CREATE TRIGGER trg_test_reversal_fault
          BEFORE INSERT ON transaction_reversal
          FOR EACH ROW EXECUTE FUNCTION trg_inject_reversal_error();
      `);

      try {
        await assert.rejects(
          async () => {
            await withTransaction(async (tx) => {
              await setRlsContext(tx, { userId: adminUserId, branchId: null, roleName: 'ADMIN' });
              await tx.query(`
                CALL sp_reverse_transaction($1, $2, $3, NULL, NULL, NULL)
              `, [originalTransactionId, 'FORCE_MID_REVERSAL_FAILURE', adminUserId]);
            });
          },
          (err) => {
            return err.message?.includes('TEST_INJECTED_REVERSAL_FAILURE') ||
                   err.code === 'UNEXPECTED_DB_ERROR' ||
                   err.sqlstate === 'P0001';
          },
          'Expected sp_reverse_transaction to abort due to injected mid-transaction failure'
        );

        // Verify ATOMICITY:
        // 1. No row in transaction_reversal
        const revLinkRows = await ownerClient.query(`
          SELECT COUNT(*) AS cnt FROM transaction_reversal WHERE original_transaction_id = $1
        `, [originalTransactionId]);
        assert.equal(Number(revLinkRows.rows[0].cnt), 0, 'No reversal link must exist');

        // 2. CRUCIAL: No compensating REVERSAL row in transaction (no orphan!)
        const compRows = await ownerClient.query(`
          SELECT COUNT(*) AS cnt FROM transaction
          WHERE account_id = $1 AND transaction_type = 'REVERSAL'
        `, [accountId]);
        assert.equal(Number(compRows.rows[0].cnt), 0, 'No orphaned compensating REVERSAL row in ledger must survive');

        // 3. Balance remains unchanged at 6000.00
        const curBal = (await ownerClient.query(`SELECT current_balance FROM account WHERE account_id = $1`, [accountId])).rows[0].current_balance;
        assert.equal(Number(curBal), 6000.00, 'Account balance must remain 6000.00');
      } finally {
        await ownerClient.query(`
          DROP TRIGGER IF EXISTS trg_test_reversal_fault ON transaction_reversal;
          DROP FUNCTION IF EXISTS trg_inject_reversal_error();
        `);
      }

      // Now execute legitimate reversal to verify the original transaction remained in a healthy state
      await withTransaction(async (tx) => {
        await setRlsContext(tx, { userId: adminUserId, branchId: null, roleName: 'ADMIN' });
        await tx.query(`
          CALL sp_reverse_transaction($1, $2, $3, NULL, NULL, NULL)
        `, [originalTransactionId, 'Legitimate customer correction', adminUserId]);
      });

      const finalBal = (await ownerClient.query(`SELECT current_balance FROM account WHERE account_id = $1`, [accountId])).rows[0].current_balance;
      assert.equal(Number(finalBal), 5000.00, 'Legitimate reversal after aborted attempt succeeds and restores balance');
    });

    await t.test('4. HTTP layer idempotency replay across a real round-trip: exactly one debit/credit effect', async () => {
      const { accountId } = await createTestAccount('1000.00', 'HTTP-IDEM');

      // Create session for the agent user using ownerClient
      const { token: sessionToken } = await createSession(agentUserId, '127.0.0.1', 'EvidenceHarness/1.0', ownerClient);
      const csrfToken = randomBytes(32).toString('hex');
      const idempotencyKey = `IDEM-HTTP-ROUNDTRIP-${randomUUID()}`;

      const headers = {
        'content-type': 'application/json',
        'cookie': `mims_session=${sessionToken}; mims_csrf=${csrfToken}`,
        'x-csrf-token': csrfToken,
        'idempotency-key': idempotencyKey,
      };

      const depositPayload = {
        accountId,
        amount: '350.00',
        channelId,
        narration: 'HTTP Idempotency Test',
      };

      // First request: Must succeed with 201 Created
      const req1 = new NextRequest('http://localhost:3000/api/transactions/deposits', {
        method: 'POST',
        headers,
        body: JSON.stringify(depositPayload),
      });

      const res1 = await depositRoutePost(req1);
      assert.equal(res1.status, 201, `Expected 201 Created on initial deposit, got ${res1.status}`);
      const json1 = await res1.json();
      assert.ok(json1.data?.referenceNumber, 'Initial response must include referenceNumber');
      assert.equal(Number(json1.data.balanceAfter), 1350.00, 'balanceAfter must be 1350.00');

      // Second request: Replay with identical key must return 200 OK with identical payload
      const req2 = new NextRequest('http://localhost:3000/api/transactions/deposits', {
        method: 'POST',
        headers,
        body: JSON.stringify(depositPayload),
      });

      const res2 = await depositRoutePost(req2);
      assert.equal(res2.status, 200, `Expected 200 OK on replayed request, got ${res2.status}`);
      const json2 = await res2.json();
      assert.equal(json2.data.referenceNumber, json1.data.referenceNumber, 'Replayed reference number must match exactly');
      assert.equal(Number(json2.data.balanceAfter), Number(json1.data.balanceAfter), 'Replayed balanceAfter must match exactly');

      // Verify DB state: Balance credited ONCE, exactly ONE ledger row
      const accRows = await ownerClient.query(`SELECT current_balance FROM account WHERE account_id = $1`, [accountId]);
      assert.equal(Number(accRows.rows[0].current_balance), 1350.00, 'Account balance must be 1350.00 (not 1700.00)');

      const txRows = await ownerClient.query(`SELECT COUNT(*) AS cnt FROM transaction WHERE idempotency_key = $1`, [idempotencyKey]);
      assert.equal(Number(txRows.rows[0].cnt), 1, 'Exactly one ledger row must exist for this idempotency key');
    });

    await t.test('5. Reusing an idempotency key with an altered payload fails safely without side effects', async () => {
      const { accountId } = await createTestAccount('2000.00', 'IDEM-ALT');
      const { token: sessionToken } = await createSession(agentUserId, '127.0.0.1', 'EvidenceHarness/1.0', ownerClient);
      const csrfToken = randomBytes(32).toString('hex');
      const idempotencyKey = `IDEM-PAYLOAD-TAMPER-${randomUUID()}`;

      const headers = {
        'content-type': 'application/json',
        'cookie': `mims_session=${sessionToken}; mims_csrf=${csrfToken}`,
        'x-csrf-token': csrfToken,
        'idempotency-key': idempotencyKey,
      };

      // 1. Initial valid request
      const req1 = new NextRequest('http://localhost:3000/api/transactions/deposits', {
        method: 'POST',
        headers,
        body: JSON.stringify({ accountId, amount: '200.00', channelId, narration: 'Original' }),
      });
      const res1 = await depositRoutePost(req1);
      assert.equal(res1.status, 201);

      // 2. Tampered request reusing the key with altered amount
      const req2 = new NextRequest('http://localhost:3000/api/transactions/deposits', {
        method: 'POST',
        headers,
        body: JSON.stringify({ accountId, amount: '999.00', channelId, narration: 'Tampered Amount' }),
      });
      const res2 = await depositRoutePost(req2);
      // The tampered amount must never credit the account
      const finalBal = (await ownerClient.query(`SELECT current_balance FROM account WHERE account_id = $1`, [accountId])).rows[0].current_balance;
      assert.equal(Number(finalBal), 2200.00, 'Tampered payload cannot credit 999.00 to account balance');
    });

    await t.test('6. Aborted transaction before commit does not lock the idempotency key against clean retry', async () => {
      const { accountId, accountNumber } = await createTestAccount('1500.00', 'FAIL-RETRY');
      const retryKey = `IDEM-RETRY-CLEAN-${randomUUID()}`;

      // 1. Setup temporary trigger to force first attempt to abort
      await ownerClient.query(`
        CREATE OR REPLACE FUNCTION trg_fail_first_retry() RETURNS trigger AS $$
        BEGIN
          IF NEW.account_number = '${accountNumber}' THEN
            RAISE EXCEPTION 'TEST_INJECTED_ABORT' USING ERRCODE = 'P0001';
          END IF;
          RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;

        DROP TRIGGER IF EXISTS trg_test_fail_first ON account;
        CREATE TRIGGER trg_test_fail_first
          BEFORE UPDATE ON account
          FOR EACH ROW EXECUTE FUNCTION trg_fail_first_retry();
      `);

      // First attempt fails
      await assert.rejects(async () => {
        await withTransaction(async (tx) => {
          await setRlsContext(tx, { userId: agentUserId, branchId, roleName: 'AGENT' });
          await tx.query(`CALL sp_post_deposit($1, $2, $3, $4, $5, $6, NULL, NULL, NULL, NULL)`,
            [accountId, '300.00', channelId, agentUserId, retryKey, 'First Attempt']);
        });
      });

      // Remove trigger
      await ownerClient.query(`
        DROP TRIGGER IF EXISTS trg_test_fail_first ON account;
        DROP FUNCTION IF EXISTS trg_fail_first_retry();
      `);

      // 2. Second attempt with the SAME key succeeds cleanly
      const successRes = await withTransaction(async (tx) => {
        await setRlsContext(tx, { userId: agentUserId, branchId, roleName: 'AGENT' });
        const res = await tx.query(`CALL sp_post_deposit($1, $2, $3, $4, $5, $6, NULL, NULL, NULL, NULL)`,
          [accountId, '300.00', channelId, agentUserId, retryKey, 'Second Attempt Retry']);
        return res.rows[0];
      });

      assert.ok(successRes.p_transaction_id, 'Second attempt with same key must succeed after aborted first attempt');
      assert.equal(Number(successRes.p_balance_after), 1800.00);

      const finalBal = (await ownerClient.query(`SELECT current_balance FROM account WHERE account_id = $1`, [accountId])).rows[0].current_balance;
      assert.equal(Number(finalBal), 1800.00, 'Balance correctly updated exactly once on successful retry');
    });
  } finally {
    try {
      if (savedBusinessStart && savedBusinessEnd) {
        await ownerClient.query(`UPDATE system_parameter SET param_value = $1 WHERE param_key = 'BUSINESS_HOUR_START'`, [savedBusinessStart]);
        await ownerClient.query(`UPDATE system_parameter SET param_value = $1 WHERE param_key = 'BUSINESS_HOUR_END'`, [savedBusinessEnd]);
      }
    } catch (e) {
      console.error('Error restoring parameters:', e);
    }
    try {
      await ownerClient.end();
    } catch (e) {
      console.error('Error ending ownerClient:', e);
    }
  }
});
