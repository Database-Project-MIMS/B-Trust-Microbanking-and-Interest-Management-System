'use client';
import { useEffect,useState } from 'react';
import Link from 'next/link';
import { displayMoney } from '@/app/accounts/account-format';
interface Row {transactionId:string;referenceNumber:string;transactionType:string;amount:string;balanceAfter:string|null;transactionDate:string}
export function StatementScreen({id}:{id:string}){
  const [rows,setRows]=useState<Row[]>([]),[page,setPage]=useState(1),[total,setTotal]=useState(0),[error,setError]=useState(''),[loading,setLoading]=useState(true),[attempt,setAttempt]=useState(0);
  useEffect(()=>{const c=new AbortController();setLoading(true);setError('');
    fetch(`/api/accounts/${encodeURIComponent(id)}/transactions?page=${page}&pageSize=20`,{signal:c.signal,cache:'no-store',credentials:'same-origin'})
      .then(async res=>{const body=await res.json();if(c.signal.aborted)return;if(!res.ok)throw new Error(body.error?.message ?? 'Unable to load statement.');setRows(body.data);setTotal(body.meta.total);})
      .catch(e=>{if(!c.signal.aborted)setError(e instanceof Error?e.message:'Unable to load statement.');}).finally(()=>{if(!c.signal.aborted)setLoading(false);});return()=>c.abort();
  },[id,page,attempt]);
  return <div className="space-y-6"><div className="page-header"><h1 className="page-title">Account statement</h1><Link className="btn btn-secondary" href={`/accounts/${id}`}>Account details</Link></div>
    {error?<div className="card" role="alert">{error}<button className="btn btn-secondary" onClick={()=>setAttempt(n=>n+1)}>Retry</button></div>:loading?<p role="status">Loading statement…</p>:
      <section className="card"><div className="table-wrap"><table className="data-table"><caption>Latest postings first · Colombo time</caption><thead><tr><th>Reference</th><th>Time</th><th>Type</th><th>Amount</th><th>Balance after</th></tr></thead><tbody>
        {rows.map(row=><tr key={row.transactionId}><th scope="row"><Link href={`/transactions/${row.transactionId}`}>{row.referenceNumber}</Link></th><td>{new Date(row.transactionDate).toLocaleString('en-GB',{timeZone:'Asia/Colombo'})}</td><td>{row.transactionType}</td><td className="amount">{displayMoney(row.amount)}</td><td className="amount">{row.balanceAfter===null?'Unavailable':displayMoney(row.balanceAfter)}</td></tr>)}
        {!rows.length&&<tr><td colSpan={5}>No transactions for this account.</td></tr>}</tbody></table></div><nav className="flex gap-4 mt-4" aria-label="Statement pages"><button className="btn btn-secondary" disabled={page===1} onClick={()=>setPage(n=>n-1)}>Previous</button><span role="status">Page {page} · {total} postings</span><button className="btn btn-secondary" disabled={page*20>=total} onClick={()=>setPage(n=>n+1)}>Next</button></nav></section>}
  </div>;
}
