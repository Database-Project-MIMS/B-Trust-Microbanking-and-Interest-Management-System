'use client';
import { useEffect,useRef,useState } from 'react';
import Link from 'next/link';
import { accountRequest,csrfToken } from '@/app/accounts/account-client';
import { displayMoney } from '@/app/accounts/account-format';
import { AccountSelector, type AccountChoice } from '@/components/mims/account-selector';
type Detail={status:string;accountNumber:string;currentBalance:string;holders:{customerId:string;fullName:string}[];mandate:{mandateType:string}|null};
type Receipt={transactionId:string;referenceNumber:string;amount:string;balanceAfter:string;postedAt:string};
export function PostingScreen({kind,channels,ownAccounts,initialId=''}:{kind:'deposit'|'withdraw';channels:{channelId:string;channelName:string}[];ownAccounts?:AccountChoice[];initialId?:string}){
  const [accountId,setAccountId]=useState(initialId),[amount,setAmount]=useState(''),[channelId,setChannelId]=useState(channels[0]?.channelId ?? '');
  const [narration,setNarration]=useState(''),[signers,setSigners]=useState<string[]>([]),[detail,setDetail]=useState<Detail|null>(null);
  const [review,setReview]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(''),[receipt,setReceipt]=useState<Receipt|null>(null);
  const key=useRef<string|null>(null);
  function loadAccount(id:string){setAccountId(id);setDetail(null);setReview(false);setSigners([]);key.current=null;}
  useEffect(()=>{if(!accountId)return;const c=new AbortController();
    accountRequest<Detail>(`/api/accounts/${encodeURIComponent(accountId)}`,{signal:c.signal}).then(res=>{
      if(c.signal.aborted)return;if(res.ok&&res.data)setDetail(res.data);else setError(res.error?.message ?? 'Unable to load the account.');
    }).catch(()=>{});return()=>c.abort();},[accountId]);
  async function prepare(){setError('');setBusy(true);
    try {if(!/[1-9]/.test(amount)){setError('Enter a positive amount.');return;}const res=await accountRequest<Detail>(`/api/accounts/${encodeURIComponent(accountId)}`);
      if(!res.ok||!res.data){setError(res.error?.message ?? 'Unable to load account.');return;}setDetail(res.data);if(res.data.status!=='ACTIVE'){setError('Choose an active account.');return;}
      if(kind==='withdraw'&&!ownAccounts&&!signers.length){setError('Select the holders whose authorization you have checked.');return;}
      if(!key.current)key.current=crypto.randomUUID();setReview(true);
    }finally{setBusy(false);}}
  async function post(){setBusy(true);setError('');
    try {const response=await accountRequest<Receipt>(`/api/transactions/${kind==='deposit'?'deposits':'withdrawals'}`,{
      method:'POST',headers:{'content-type':'application/json','x-csrf-token':csrfToken(),'idempotency-key':key.current ?? ''},
      body:JSON.stringify({accountId,amount,channelId,...(narration?{narration}:{}),...(kind==='withdraw'&&!ownAccounts?{signerCustomerIds:signers}:{})})});
      if(response.ok&&response.data){setReceipt(response.data);setReview(false);}else setError(response.error?.message ?? 'Unable to post transaction.');
    }finally{setBusy(false);}}
  return <div className="space-y-6"><div className="page-header"><div><p className="eyebrow">Transactions</p><h1 className="page-title">{kind==='deposit'?'Post a deposit':'Post a withdrawal'}</h1></div></div>
    {error&&<p className="card" role="alert">{error}</p>}{receipt?<section className="card space-y-4" role="status"><h2>Transaction posted</h2><p>{receipt.referenceNumber}</p>
      <dl><div><dt>Amount</dt><dd className="amount">{displayMoney(receipt.amount)}</dd></div><div><dt>Balance after posting</dt><dd className="amount">{displayMoney(receipt.balanceAfter)}</dd></div></dl>
      <Link className="btn btn-primary" href={`/transactions/${receipt.transactionId}`}>View receipt</Link><Link className="btn btn-secondary" href={`/accounts/${accountId}/statement`}>View statement</Link></section>:
      review?<section className="card confirmation-card space-y-4"><h2>Confirm {kind==='deposit'?'deposit':'withdrawal'}</h2><p>{detail?.accountNumber} · {displayMoney(amount)}</p>
        <p>{narration || 'No narration'}</p>{kind==='withdraw'&&!ownAccounts&&<p>Authorization checked for {signers.length} holder(s).</p>}
        <p>Account status, balance, hours and authorization are checked again when posting.</p>
        <button className="btn btn-secondary" disabled={busy} onClick={()=>{setReview(false);key.current=null;}}>Back to edit</button>
        <button className="btn btn-primary" disabled={busy} onClick={()=>void post()}>{busy?'Posting…':'Confirm and post'}</button></section>:
      <form className="card space-y-4 max-w-3xl" onSubmit={event=>{event.preventDefault();void prepare();}}><fieldset disabled={busy} className="space-y-4">
        <AccountSelector value={accountId} onChange={id=>void loadAccount(id)} initialAccounts={ownAccounts}/>
        <label className="field">Amount in LKR (required)<input className="input" inputMode="decimal" required pattern="[0-9]{1,13}[.][0-9]{2}" value={amount} onChange={e=>{setAmount(e.target.value);key.current=null;}}/><small>Enter a positive amount with two decimal places.</small></label>
        <label className="field">Channel (required)<select className="input" required value={channelId} onChange={e=>{setChannelId(e.target.value);key.current=null;}}>{channels.map(row=><option key={row.channelId} value={row.channelId}>{row.channelName.replaceAll('_',' ')}</option>)}</select></label>
        <label className="field">Narration<input className="input" maxLength={255} value={narration} onChange={e=>{setNarration(e.target.value);key.current=null;}}/></label>
        {kind==='withdraw'&&!ownAccounts&&<fieldset><legend>Holder authorization (required)</legend><p>Check physical signer evidence before selecting a holder. {detail?.mandate?.mandateType==='ALL_HOLDERS'?'All holders must authorize this withdrawal.':''}</p>
          {detail?.holders.map(holder=><label className="flex gap-3" key={holder.customerId}><input type="checkbox" checked={signers.includes(holder.customerId)} onChange={e=>{setSigners(ids=>e.target.checked?[...ids,holder.customerId]:ids.filter(id=>id!==holder.customerId));key.current=null;}}/>{holder.fullName}</label>)}</fieldset>}
        <button className="btn btn-primary" disabled={busy||!accountId||!channels.length}>Review transaction</button></fieldset></form>}
  </div>;
}
