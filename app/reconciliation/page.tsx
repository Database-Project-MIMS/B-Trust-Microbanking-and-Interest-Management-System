import {runReconciliationCheck} from '@/services/reconciliation-service';
import {requirePageRole} from '@/lib/auth/page-access';
import {displayMoney} from '@/app/accounts/account-format';
export default async function ReconciliationPage(){
 const report=await runReconciliationCheck(await requirePageRole('ADMIN','CENTRAL_OPS','AUDITOR'));
 return <div className="space-y-6"><div className="page-header"><div><p className="eyebrow">Financial controls</p><h1 className="page-title">Ledger reconciliation</h1></div></div>
 <section className="card" role="status"><h2>{report.accountDiscrepancies.length||report.transactionDiscrepancies.length?'Discrepancies require review':'Ledger and balances agree'}</h2><p>{report.totalAccounts} accounts · {report.totalTransactions} transactions checked.</p></section>
 <section className="card table-wrap"><h2>Account discrepancies</h2><table className="data-table"><thead><tr><th>Account</th><th>Stored balance</th><th>Ledger balance</th><th>Difference</th></tr></thead><tbody>{report.accountDiscrepancies.map(r=><tr key={r.accountId}><td>{r.accountNumber}</td><td>{displayMoney(r.storedBalance)}</td><td>{displayMoney(r.computedBalance)}</td><td>{displayMoney(r.discrepancy)}</td></tr>)}{!report.accountDiscrepancies.length&&<tr><td colSpan={4}>No account discrepancies.</td></tr>}</tbody></table></section>
 <section className="card table-wrap"><h2>Posting discrepancies</h2><table className="data-table"><thead><tr><th>Transaction</th><th>Stored balance after</th><th>Computed balance</th><th>Difference</th></tr></thead><tbody>{report.transactionDiscrepancies.map(r=><tr key={r.transactionId}><td>{r.transactionId}</td><td>{displayMoney(r.storedBalanceAfter)}</td><td>{displayMoney(r.computedRunningBalance)}</td><td>{displayMoney(r.discrepancy)}</td></tr>)}{!report.transactionDiscrepancies.length&&<tr><td colSpan={4}>No posting discrepancies.</td></tr>}</tbody></table></section></div>;
}
