import React from 'react';
import { cookies } from 'next/headers';
import { validateSession } from '@/lib/auth/session';
import { redirect } from 'next/navigation';
import { runReconciliationCheck } from '@/services/reconciliation-service';

export default async function ReconciliationPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get('mims_session')?.value;
  if (!token) redirect('/login');
  
  const session = await validateSession(token);
  if (!session || !['CENTRAL_OPS', 'AUDITOR', 'ADMIN'].includes(session.roleName)) {
    redirect('/unauthorized');
  }

  const report = await runReconciliationCheck();
  const accCount = report.accountDiscrepancies.length;
  const txCount = report.transactionDiscrepancies.length;
  const isHealthy = accCount === 0 && txCount === 0;

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <h1 className="text-3xl font-bold mb-6 text-gray-900">Ledger Reconciliation</h1>
      
      <div className={`mb-8 p-6 rounded-lg shadow-sm border-l-4 ${isHealthy ? 'bg-green-50 border-green-500 text-green-800' : 'bg-red-50 border-red-500 text-red-800'}`}>
        <h2 className="text-xl font-semibold mb-2">System Health Status</h2>
        <p className="text-lg">
          {report.totalAccounts} accounts and {report.totalTransactions} transactions reconciled.
          <br/>
          <strong>{accCount} account discrepancies</strong> and <strong>{txCount} transaction discrepancies</strong> found.
        </p>
      </div>

      <div className="space-y-12">
        <section>
          <h2 className="text-2xl font-semibold mb-4 text-gray-800">Account Balance Discrepancies (D-1)</h2>
          {accCount === 0 ? (
            <p className="text-gray-500 italic">No discrepancies found.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 shadow-sm rounded-lg overflow-hidden">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Account Number</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Stored Balance</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Computed Balance</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Discrepancy</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {report.accountDiscrepancies.map(acc => (
                    <tr key={acc.accountId} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{acc.accountNumber}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-500">{acc.storedBalance}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-500">{acc.computedBalance}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-bold text-red-600">{acc.discrepancy}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-4 text-gray-800">Transaction Balance Discrepancies (D-2)</h2>
          {txCount === 0 ? (
            <p className="text-gray-500 italic">No discrepancies found.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 shadow-sm rounded-lg overflow-hidden">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Transaction ID</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Account ID</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Stored Balance After</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Computed Balance</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Discrepancy</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {report.transactionDiscrepancies.map(tx => (
                    <tr key={tx.transactionId} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{tx.transactionId}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{tx.accountId}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-500">{tx.storedBalanceAfter}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-500">{tx.computedRunningBalance}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-bold text-red-600">{tx.discrepancy}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
