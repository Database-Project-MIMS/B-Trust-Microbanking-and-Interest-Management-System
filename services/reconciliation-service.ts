import 'server-only';
import { withTransaction, NotAuthorizedError } from "@/lib/db";
import { setRlsContext } from '@/lib/db/rls-context';
import type { TransactionActor } from './transaction-service';

export interface AccountDiscrepancy {
  accountId: string;
  accountNumber: string;
  storedBalance: string;
  computedBalance: string;
  discrepancy: string;
}

export interface TransactionDiscrepancy {
  transactionId: string;
  accountId: string;
  storedBalanceAfter: string;
  computedRunningBalance: string;
  discrepancy: string;
}

export interface ReconciliationReport {
  totalAccounts: number;
  totalTransactions: number;
  accountDiscrepancies: AccountDiscrepancy[];
  transactionDiscrepancies: TransactionDiscrepancy[];
}

/**
 * Transaction boundary: Read-only reconciliation snapshot.
 */
export async function runReconciliationCheck(actor: TransactionActor): Promise<ReconciliationReport> {
  if (!['ADMIN','CENTRAL_OPS','AUDITOR'].includes(actor.roleName)) throw new NotAuthorizedError();
  return withTransaction(async client => {
    const current=(await client.query(`SELECT r.role_name FROM app_user u JOIN role r ON r.role_id=u.role_id
      WHERE u.user_id=$1 AND u.status='ACTIVE' AND r.status='ACTIVE'`,[actor.userId])).rows[0];
    if (current?.role_name!==actor.roleName) throw new NotAuthorizedError();
    await setRlsContext(client, actor);
    const accResult = await client.query(`
      SELECT account_id, account_number, stored_balance, computed_balance, discrepancy
      FROM vw_reconciliation_balance
      WHERE discrepancy <> 0
    `);

    const txResult = await client.query(`
      SELECT transaction_id, account_id, stored_balance_after, computed_running_balance,
             (stored_balance_after - computed_running_balance) AS discrepancy
      FROM vw_reconciliation_running_balance
      WHERE stored_balance_after <> computed_running_balance
    `);

    const totalAccResult = await client.query(`SELECT COUNT(*) AS total FROM vw_reconciliation_balance`);
    const totalTxResult = await client.query(`SELECT COUNT(*) AS total FROM vw_reconciliation_running_balance`);

    return {
      totalAccounts: parseInt(totalAccResult.rows[0].total, 10),
      totalTransactions: parseInt(totalTxResult.rows[0].total, 10),
      accountDiscrepancies: accResult.rows.map(r => ({
        accountId: r.account_id,
        accountNumber: r.account_number,
        storedBalance: r.stored_balance,
        computedBalance: r.computed_balance,
        discrepancy: r.discrepancy,
      })),
      transactionDiscrepancies: txResult.rows.map(r => ({
        transactionId: r.transaction_id,
        accountId: r.account_id,
        storedBalanceAfter: r.stored_balance_after,
        computedRunningBalance: r.computed_running_balance,
        discrepancy: r.discrepancy,
      })),
    };
  }, { isolationLevel: 'REPEATABLE READ' });
}
