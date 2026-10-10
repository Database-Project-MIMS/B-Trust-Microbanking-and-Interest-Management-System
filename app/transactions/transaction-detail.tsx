'use client';
import { useEffect,useRef,useState } from 'react';
import Link from 'next/link';
import { accountRequest,csrfToken } from '@/app/accounts/account-client';
import { displayMoney } from '@/app/accounts/account-format';
interface Receipt {transactionId:string;accountId:string;referenceNumber:string;transactionType:string;amount:string;balanceAfter:string;transactionDate:string;narration:string|null;isReversed:boolean;canReverse:boolean}
export function TransactionDetail({id,canReverse}:{id:string;canReverse:boolean}){
  const [row,setRow]=useState<Receipt|null>(null),[error,setError]=useState(''),[attempt,setAttempt]=useState(0);
  const [reason,setReason]=useState(''),[confirm,setConfirm]=useState(false),[busy,setBusy]=useState(false),[done,setDone]=useState('');const key=useRef<string|null>(null);
  useEffect(()=>{const c=new AbortController();setError('');accountRequest<Receipt>(`/api/transactions/${encodeURIComponent(id)}`,{signal:c.signal})
    .then(res=>{if(c.signal.aborted)return;if(res.ok&&res.data)setRow(res.data);else setError(res.error?.message ?? 'Unable to load receipt.');}).catch(()=>{});return()=>c.abort();},[id,attempt]);
  async function reverse(){setBusy(true);setError('');if(!key.current)key.current=crypto.randomUUID();
    const res=await accountRequest<{reversalTransactionId:string}>(`/api/transactions/${encodeURIComponent(id)}/reverse`,{method:'POST',
      headers:{'content-type':'application/json','x-csrf-token':csrfToken(),'idempotency-key':key.current},body:JSON.stringify({reason})});
    setBusy(false);if(res.ok&&res.data){setDone(res.data.reversalTransactionId);setConfirm(false);setAttempt(n=>n+1);}else setError(res.error?.message ?? 'Unable to reverse transaction.');}
  return <div className="space-y-6"><h1 className="page-title">Transaction receipt</h1>{error&&<div className="card" role="alert">{error}<button className="btn btn-secondary" onClick={()=>setAttempt(n=>n+1)}>Retry</button></div>}
    {!row&&!error&&<p role="status">Loading receipt…</p>}{row&&<><section className="card"><h2>{row.referenceNumber}</h2><dl>
      <div><dt>Type</dt><dd>{row.transactionType}</dd></div><div><dt>Amount</dt><dd className="amount">{displayMoney(row.amount)}</dd></div><div><dt>Balance after posting</dt><dd className="amount">{displayMoney(row.balanceAfter)}</dd></div>
      <div><dt>Time (Colombo)</dt><dd>{new Date(row.transactionDate).toLocaleString('en-GB',{timeZone:'Asia/Colombo'})}</dd></div><div><dt>Narration</dt><dd>{row.narration ?? '—'}</dd></div><div><dt>Reversed</dt><dd>{row.isReversed?'Yes':'No'}</dd></div></dl>
      <Link className="btn btn-secondary" href={`/accounts/${row.accountId}/statement`}>Account statement</Link></section>
      {canReverse&&row.canReverse&&!row.isReversed&&<form className="card space-y-4" onSubmit={e=>{e.preventDefault();setConfirm(true);}}>
        <h2>Reverse transaction</h2><label className="field">Reason (required)<input className="input" required maxLength={255} disabled={busy||confirm} value={reason} onChange={e=>{setReason(e.target.value);key.current=null;}}/></label>
        {confirm?<div className="confirmation-card"><p>Post a compensating entry for {displayMoney(row.amount)}? {row.transactionType.startsWith('TRANSFER_')?'Both legs of this transfer will be reversed.':'The original receipt remains in the ledger.'}</p><button type="button" className="btn btn-primary" disabled={busy} onClick={()=>void reverse()}>{busy?'Reversing…':'Confirm reversal'}</button><button type="button" className="btn btn-secondary" disabled={busy} onClick={()=>setConfirm(false)}>Cancel</button></div>:<button className="btn btn-secondary">Review reversal</button>}</form>}
      {done&&<p className="card" role="status">Reversal posted. <Link href={`/transactions/${done}`}>View compensating receipt</Link></p>}</>}
  </div>;
}
