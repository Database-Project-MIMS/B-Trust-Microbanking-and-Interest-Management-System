import Link from 'next/link';
import {requirePageRole} from '@/lib/auth/page-access';
import {getOwnedAccounts} from '@/services/transaction-service';
import {displayMoney} from '@/app/accounts/account-format';
export default async function MyAccounts(){const user=await requirePageRole('CUSTOMER');const ownAccounts=await getOwnedAccounts(user);
return <div className="space-y-6"><div className="page-header"><h1 className="page-title">My savings accounts</h1></div><section className="card"><table className="data-table"><thead><tr><th>Account</th><th>Balance</th><th>Actions</th></tr></thead><tbody>{ownAccounts?.map(a=><tr key={a.accountId}><td>{a.accountNumber}</td><td className="amount">{displayMoney(a.currentBalance)}</td><td><Link className="btn btn-secondary" href={`/accounts/${a.accountId}`}>View account</Link><Link className="btn btn-secondary" href={`/accounts/${a.accountId}/statement`}>Statement</Link></td></tr>)}{!ownAccounts?.length&&<tr><td colSpan={3}>You have no savings accounts.</td></tr>}</tbody></table></section></div>;}
