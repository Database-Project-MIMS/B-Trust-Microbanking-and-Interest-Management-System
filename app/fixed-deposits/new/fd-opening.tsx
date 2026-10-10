"use client";
import { useEffect,useRef,useState } from 'react';
import Link from 'next/link';
import { accountRequest,csrfToken } from '@/app/accounts/account-client';
import { displayDate,displayRate } from '@/app/accounts/account-format';
import { AccountSelector } from '@/components/mims/account-selector';
import { reportMoney } from '@/components/report/report-format';
import type { FixedDepositRow } from '@/services/fixed-deposit-service';
type Product={fdPlanId:string;planName:string;interestRate:string;status:string;effectiveTo:string|null;effectiveFrom:string|null};
type Quote={accountNumber:string;principalAmount:string;balanceAfter:string};
export function FdOpening({initialId=""}:{initialId?:string}){
  const [products,setProducts]=useState<Product[]>([]);
  const [value,setValue]=useState({accountId:initialId,fdPlanId:'',principalAmount:''});
  const [quote,setQuote]=useState<Quote|null>(null),[result,setResult]=useState<FixedDepositRow|null>(null);
  const [error,setError]=useState(''),[busy,setBusy]=useState(false),[loading,setLoading]=useState(true);
  const key=useRef<string|null>(null);
  useEffect(()=>{
    const controller=new AbortController();
    accountRequest<Product[]>('/api/fd-products',{signal:controller.signal}).then(p=>{
      if(!p.ok){setError(p.error?.message ?? 'Unable to load opening choices.');return;}
      const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Colombo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
      setProducts((p.data ?? []).filter(row=>row.status==='ACTIVE' && (!row.effectiveFrom||row.effectiveFrom.slice(0,10)<=today) && (!row.effectiveTo||row.effectiveTo.slice(0,10)>today)));
    }).catch(()=>{if(!controller.signal.aborted)setError('Unable to load opening choices.');})
      .finally(()=>{if(!controller.signal.aborted)setLoading(false);});
    return ()=>controller.abort();
  },[]);
  async function review(){
    setBusy(true);setError('');
    try{
      const response=await accountRequest<Quote>('/api/fixed-deposits/quote?'+new URLSearchParams(value));
      if(!response.ok || !response.data){setError(response.error?.message ?? 'Unable to preview this deposit.');return;}
      key.current=crypto.randomUUID();setQuote(response.data);
    }finally{setBusy(false);}
  }
  async function confirm(){
    setBusy(true);setError('');
    try{
      const response=await accountRequest<FixedDepositRow>('/api/fixed-deposits',{method:'POST',
        headers:{'content-type':'application/json','x-csrf-token':csrfToken(),'idempotency-key':key.current ?? ''},
        body:JSON.stringify(value)});
      if(!response.ok || !response.data){setError(response.error?.message ?? 'Unable to open this deposit.');return;}
      setResult(response.data);setQuote(null);
    }finally{setBusy(false);}
  }
  const product=products.find(row=>row.fdPlanId===value.fdPlanId);
  return <div className="space-y-6"><div className="page-header"><div><p className="eyebrow">Fixed deposits</p>
    <h1 className="page-title">Open a fixed deposit</h1><p className="page-description">Fund a fixed deposit from an active savings account.</p></div></div>
    {error && <p className="card" role="alert">{error}</p>}
    {loading ? <p className="card" role="status">Loading accounts and products…</p> : result ?
      <section className="card space-y-4" role="status"><h2 className="section-heading">Fixed deposit opened</h2>
        <p>{result.accountNumber} · {reportMoney(result.principalAmount)} · {displayRate(result.rate)}</p>
        <p>Matures {displayDate(result.maturityDate)} · next payout {displayDate(result.nextInterestDate)}</p>
        <Link className="btn btn-primary" href="/fixed-deposits">View fixed deposits</Link></section> : quote ?
      <section className="card confirmation-card space-y-4"><h2 className="section-heading">Confirm principal transfer</h2>
        <dl><div><dt>Account</dt><dd>{quote.accountNumber}</dd></div><div><dt>Principal debit</dt><dd className="amount">{reportMoney(quote.principalAmount)}</dd></div>
          <div><dt>Projected savings balance</dt><dd className="amount">{reportMoney(quote.balanceAfter)}</dd></div>
          <div><dt>Product and rate</dt><dd>{product?.planName} · {displayRate(product?.interestRate)}</dd></div></dl>
        <p>The balance and product are checked again when you confirm.</p>
        <div className="flex gap-4"><button className="btn btn-secondary" disabled={busy} onClick={()=>{setQuote(null);key.current=null;}}>Back to edit</button>
          <button className="btn btn-primary" disabled={busy} onClick={()=>void confirm()}>{busy?'Opening…':'Confirm and open'}</button></div></section> :
      <form className="card form-grid max-w-3xl" onSubmit={event=>{event.preventDefault();void review();}}>
        <AccountSelector value={value.accountId} onChange={accountId=>setValue({...value,accountId})} disabled={busy}/>
        <label className="field">FD product (required)<select className="input" required value={value.fdPlanId} onChange={event=>setValue({...value,fdPlanId:event.target.value})}>
          <option value="">Select a product</option>{products.map(row=><option key={row.fdPlanId} value={row.fdPlanId}>{row.planName} · {displayRate(row.interestRate)}</option>)}</select></label>
        <label className="field">Principal in LKR (required)<input className="input" inputMode="decimal" required pattern="^[0-9]{1,13}[.][0-9]{2}$"
          value={value.principalAmount} onChange={event=>setValue({...value,principalAmount:event.target.value})}/><small>Enter a positive amount with two decimal places.</small></label>
        <button className="btn btn-primary" disabled={busy || !value.accountId || !products.length} type="submit">{busy?'Preparing…':'Review fixed deposit'}</button></form>}
  </div>;
}
