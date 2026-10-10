"use client";
import { useEffect,useState } from 'react';
import Link from 'next/link';
import { accountRequest } from '@/app/accounts/account-client';
import { displayDate,displayRate } from '@/app/accounts/account-format';
import { reportMoney } from '@/components/report/report-format';
import type { FixedDepositRow } from '@/services/fixed-deposit-service';
type Result={rows:FixedDepositRow[];totalRows:number;page:number;pageSize:number};
export function FdList({canOpen}:{canOpen:boolean}){
  const [page,setPage]=useState(1),[result,setResult]=useState<Result|null>(null),[error,setError]=useState(''),[loading,setLoading]=useState(true);
  useEffect(()=>{
    const controller=new AbortController();setLoading(true);setError('');
    accountRequest<Result>('/api/fixed-deposits?page='+page,{signal:controller.signal}).then(response=>{
      if(response.ok)setResult(response.data ?? null);else setError(response.error?.message ?? 'Unable to load fixed deposits.');
    }).catch(()=>{if(!controller.signal.aborted)setError('Unable to load fixed deposits.');})
      .finally(()=>{if(!controller.signal.aborted)setLoading(false);});
    return ()=>controller.abort();
  },[page]);
  return <div className="space-y-6"><div className="page-header"><div><p className="eyebrow">Savings products</p>
    <h1 className="page-title">Fixed deposits</h1><p className="page-description">Current and historical deposits in your permitted scope.</p></div>
    {canOpen && <Link className="btn btn-primary" href="/fixed-deposits/new">Open fixed deposit</Link>}</div>
    {error && <p className="card" role="alert">{error}</p>}
    {loading ? <p className="card" role="status">Loading fixed deposits…</p> : result &&
      <section className="card space-y-4"><div className="table-wrap"><table className="data-table"><caption className="sr-only">Fixed deposits</caption>
        <thead><tr>{['Account','Product','Principal','Snapshot rate','Maturity','Next payout','Status'].map(label=><th key={label} scope="col">{label}</th>)}</tr></thead>
        <tbody>{result.rows.length ? result.rows.map(row=><tr key={row.fdId}><th scope="row">{row.accountNumber}</th><td>{row.productName}</td>
          <td className="amount">{reportMoney(row.principalAmount)}</td><td className="amount">{displayRate(row.rate)}</td>
          <td>{displayDate(row.maturityDate)}</td><td>{displayDate(row.nextInterestDate)}</td><td>{row.status}</td></tr>) :
          <tr><td colSpan={7}>No fixed deposits in your permitted scope.</td></tr>}</tbody></table></div>
        <div className="flex gap-4"><button className="btn btn-secondary" disabled={page===1} onClick={()=>setPage(page-1)}>Previous</button>
          <span>Page {page} · {result.totalRows} deposits</span><button className="btn btn-secondary" disabled={page*result.pageSize>=result.totalRows} onClick={()=>setPage(page+1)}>Next</button></div></section>}
  </div>;
}
