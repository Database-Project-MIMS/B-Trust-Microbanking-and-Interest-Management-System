'use client';

import {useRef,useState} from 'react';
import Link from 'next/link';
import {accountRequest,csrfToken} from '@/app/accounts/account-client';
import {displayMoney} from '@/app/accounts/account-format';
import type {AccountChoice} from '@/components/mims/account-selector';

type Receipt={transferGroupId:string;debitTransactionId:string;sourceBalance:string};

export function CustomerTransferScreen({ownAccounts}:{ownAccounts:AccountChoice[]}){
  const [source,setSource]=useState(ownAccounts[0]?.accountId??'');
  const [destination,setDestination]=useState(''),[amount,setAmount]=useState(''),[narration,setNarration]=useState('');
  const [review,setReview]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState('');
  const [receipt,setReceipt]=useState<Receipt|null>(null);
  const key=useRef<string|null>(null);
  const sourceAccount=ownAccounts.find(account=>account.accountId===source);

  function prepare(){
    setError('');
    if(!sourceAccount){setError('Choose one of your active savings accounts.');return;}
    if(!/^\d{1,13}\.\d{2}$/.test(amount)||!/[1-9]/.test(amount)){setError('Enter a positive amount with two decimal places.');return;}
    if(!destination.trim()||ownAccounts.some(account=>account.accountNumber===destination.trim())){
      setError('Enter another customer’s account number.');return;
    }
    key.current=crypto.randomUUID();setReview(true);
  }

  async function post(){
    setBusy(true);setError('');
    try{
      const response=await accountRequest<Receipt>('/api/transactions/transfers',{
        method:'POST',headers:{'content-type':'application/json','x-csrf-token':csrfToken(),'idempotency-key':key.current??''},
        body:JSON.stringify({sourceAccountId:source,destinationAccountNumber:destination.trim(),amount,...(narration?{narration}:{})}),
      });
      if(response.ok&&response.data)setReceipt(response.data);
      else setError(response.error?.message??'Unable to transfer money.');
    }catch{setError('Unable to reach the server. Retry with the same transfer details.');}
    finally{setBusy(false);}
  }

  return <div className="space-y-6">
    <div className="page-header"><div><p className="eyebrow">My transactions</p><h1 className="page-title">Transfer money</h1>
      <p className="page-description">Send money from your savings account to another customer’s B-Trust account.</p></div></div>
    {error&&<p className="card" role="alert">{error}</p>}
    {receipt?<section className="card space-y-4" role="status"><h2>Transfer posted</h2>
      <p>Sent {displayMoney(amount)} to {destination.trim()}.</p><p>Your balance: {displayMoney(receipt.sourceBalance)}</p>
      <Link className="btn btn-primary" href={`/transactions/${receipt.debitTransactionId}`}>View receipt</Link>
      <Link className="btn btn-secondary" href={`/accounts/${source}/statement`}>View statement</Link></section>
      :review?<section className="card confirmation-card space-y-4"><h2>Confirm transfer</h2>
        <p>From {sourceAccount?.accountNumber} to {destination.trim()}</p><p className="amount">{displayMoney(amount)}</p>
        <p>{narration||'No narration'}</p><p>Account status, available balance, limits and your account mandate are checked when posting.</p>
        <button className="btn btn-secondary" disabled={busy} onClick={()=>{setReview(false);key.current=null;}}>Back to edit</button>
        <button className="btn btn-primary" disabled={busy} onClick={()=>void post()}>{busy?'Transferring…':'Confirm transfer'}</button></section>
      :!ownAccounts.length?<section className="card"><p>You have no active savings accounts available for transfers.</p></section>
      :<form className="card space-y-4 max-w-3xl" onSubmit={event=>{event.preventDefault();prepare();}}>
        <fieldset disabled={busy} className="space-y-4">
          <label className="field">From my account (required)<select className="input" required value={source} onChange={event=>setSource(event.target.value)}>
            {ownAccounts.map(account=><option key={account.accountId} value={account.accountId}>{account.accountNumber}</option>)}
          </select></label>
          {sourceAccount&&<p>Available balance: {displayMoney(sourceAccount.currentBalance)}</p>}
          <label className="field">Recipient account number (required)<input className="input" required maxLength={50} autoComplete="off" value={destination} onChange={event=>setDestination(event.target.value)}/></label>
          <label className="field">Amount in LKR (required)<input className="input" required pattern="[0-9]{1,13}[.][0-9]{2}" inputMode="decimal" value={amount} onChange={event=>setAmount(event.target.value)}/><small>Enter a positive amount with two decimal places.</small></label>
          <label className="field">Narration<input className="input" maxLength={255} value={narration} onChange={event=>setNarration(event.target.value)}/></label>
          <p>Joint accounts must permit your individual authorization. Transfers follow bank business hours and debit limits.</p>
          <button className="btn btn-primary" type="submit">Review transfer</button>
        </fieldset>
      </form>}
  </div>;
}
