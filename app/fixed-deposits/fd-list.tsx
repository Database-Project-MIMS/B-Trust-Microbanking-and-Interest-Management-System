"use client";
import { useEffect,useState } from 'react';
import Link from 'next/link';
import { accountRequest } from '@/app/accounts/account-client';
import { displayDate,displayRate } from '@/app/accounts/account-format';
import { reportMoney } from '@/components/report/report-format';
import type { FixedDepositRow } from '@/services/fixed-deposit-service';
import { RecordActions } from '@/components/mims/record-actions';
import { RecordListFilters, type RecordFilters } from '@/components/mims/record-list-filters';
type Result={rows:FixedDepositRow[];totalRows:number;page:number;pageSize:number};
const defaultFilters:RecordFilters={q:'',status:'ALL',selection:''};
export function FdList({canOpen,products}:{canOpen:boolean;products:{fdPlanId:string;planName:string}[]}){
  const [page,setPage]=useState(1),[result,setResult]=useState<Result|null>(null),[error,setError]=useState(''),[loading,setLoading]=useState(true);
  const [draftFilters,setDraftFilters]=useState(defaultFilters),[filters,setFilters]=useState(defaultFilters),[refreshVersion,setRefreshVersion]=useState(0);
  function applyFilters(value:RecordFilters){setPage(1);setFilters({...value,q:value.q.trim()});}
  useEffect(()=>{
    const controller=new AbortController();setLoading(true);setError('');
    const query=new URLSearchParams({page:String(page)});
    if(filters.q)query.set('q',filters.q);
    if(filters.status!=='ALL')query.set('status',filters.status);
    if(filters.selection)query.set('fdPlanId',filters.selection);
    accountRequest<Result>('/api/fixed-deposits?'+query,{signal:controller.signal}).then(response=>{
      if(controller.signal.aborted)return;
      if(response.ok)setResult(response.data ?? null);else setError(response.error?.message ?? 'Unable to load fixed deposits.');
    }).catch(()=>{if(!controller.signal.aborted)setError('Unable to load fixed deposits.');})
      .finally(()=>{if(!controller.signal.aborted)setLoading(false);});
    return ()=>controller.abort();
  },[page,filters,refreshVersion]);
  return <div className="space-y-6"><div className="page-header"><div><p className="eyebrow">Savings products</p>
    <h1 className="page-title">Fixed deposits</h1><p className="page-description">Current and historical deposits in your permitted scope.</p></div>
    {canOpen && <Link className="btn btn-primary" href="/fixed-deposits/new">Open fixed deposit</Link>}</div>
    <RecordListFilters resource="fixed deposits" searchLabel="Account number, owner name or customer number" selectionLabel="Product"
      options={products.map(product=>({value:product.fdPlanId,label:product.planName}))} statuses={['ACTIVE','MATURED','CLOSED']}
      value={draftFilters} onChange={setDraftFilters} onSearch={()=>applyFilters(draftFilters)}
      onClear={()=>{setDraftFilters(defaultFilters);applyFilters(defaultFilters);}} />
    {error && <div className="card space-y-3"><p role="alert">{error}</p><button className="btn btn-secondary" type="button" onClick={()=>setRefreshVersion(value=>value+1)}>Retry loading fixed deposits</button></div>}
    {loading ? <p className="card" role="status">Loading fixed deposits…</p> : !error && result &&
      <section className="card space-y-4"><div className="table-wrap"><table className="data-table"><caption className="sr-only">Fixed deposits</caption>
        <thead><tr>{['Account','Product','Principal','Snapshot rate','Maturity','Next payout','Status','Actions'].map(label=><th key={label} scope="col">{label}</th>)}</tr></thead>
        <tbody>{result.rows.length ? result.rows.map(row=><tr key={row.fdId}><th scope="row">{row.accountNumber}</th><td>{row.productName}</td>
          <td className="amount">{reportMoney(row.principalAmount)}</td><td className="amount">{displayRate(row.rate)}</td>
          <td>{displayDate(row.maturityDate)}</td><td>{displayDate(row.nextInterestDate)}</td><td>{row.status}</td>
          <td><RecordActions href={`/fixed-deposits/${row.fdId}`} name={`${row.productName} on ${row.accountNumber}`} /></td></tr>) :
          <tr><td colSpan={8}>No fixed deposits match these filters in your permitted scope.</td></tr>}</tbody></table></div>
        <div className="flex flex-wrap items-center gap-4"><button className="btn btn-secondary" disabled={page===1} onClick={()=>setPage(page-1)}>Previous</button>
          <span role="status">Page {page} · {result.totalRows} deposits</span><button className="btn btn-secondary" disabled={page*result.pageSize>=result.totalRows} onClick={()=>setPage(page+1)}>Next</button></div></section>}
  </div>;
}
