'use client';
import { useEffect, useState } from 'react';
import { accountRequest } from '@/app/accounts/account-client';
import { displayMoney } from '@/app/accounts/account-format';
export interface AccountChoice { accountId:string; accountNumber:string; currentBalance:string }
export function AccountSelector({value,onChange,disabled=false,initialAccounts,initialId=''}:{
  value:string;onChange:(id:string)=>void;disabled?:boolean;initialAccounts?:AccountChoice[];initialId?:string;
}) {
  const [q,setQ]=useState(''),[page,setPage]=useState(1),[total,setTotal]=useState(0);
  const [rows,setRows]=useState<AccountChoice[]>(initialAccounts ?? []),[error,setError]=useState('');
  const [loading,setLoading]=useState(false),[attempt,setAttempt]=useState(0);
  useEffect(()=>{
    if(initialAccounts)return;
    const controller=new AbortController(); setLoading(true); setError('');
    accountRequest<{accounts:AccountChoice[];total:number}>('/api/accounts?'+new URLSearchParams({status:'ACTIVE',...(q.trim()?{q:q.trim()}:{}),page:String(page),pageSize:'25'}),{signal:controller.signal})
      .then(response=>{if(controller.signal.aborted)return;if(response.ok&&response.data){setRows(response.data.accounts);setTotal(response.data.total);}else setError(response.error?.message ?? 'Unable to load accounts.');})
      .catch(()=>{}).finally(()=>{if(!controller.signal.aborted)setLoading(false);});
    return ()=>controller.abort();
  },[q,page,initialAccounts,attempt]);
  useEffect(()=>{if(initialId && !value)onChange(initialId);},[initialId,value,onChange]);
  return <fieldset disabled={disabled} className="space-y-3">
    {!initialAccounts && <label className="field">Find an account<input className="input" value={q} placeholder="Account number or holder name" onChange={e=>{setQ(e.target.value);setPage(1);}} /></label>}
    <label className="field">Account (required)<select className="input" required value={value} onChange={e=>onChange(e.target.value)}>
      <option value="">Select an account</option>{value&&!rows.some(row=>row.accountId===value)&&<option value={value}>Selected account {value}</option>}
      {rows.map(row=><option key={row.accountId} value={row.accountId}>{row.accountNumber} · {displayMoney(row.currentBalance)}</option>)}</select></label>
    {loading&&<p role="status">Loading accounts…</p>}{error&&<p role="alert">{error} <button type="button" className="btn btn-secondary" onClick={()=>setAttempt(n=>n+1)}>Retry</button></p>}
    {!initialAccounts&&total>25&&<div className="flex gap-3"><button type="button" className="btn btn-secondary" disabled={page===1||loading} onClick={()=>setPage(n=>n-1)}>Previous accounts</button>
      <span>Page {page} of {Math.ceil(total/25)}</span><button type="button" className="btn btn-secondary" disabled={page*25>=total||loading} onClick={()=>setPage(n=>n+1)}>More accounts</button></div>}
  </fieldset>;
}
