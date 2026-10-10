 'use client';
import {useRef,useState,useEffect} from 'react';
import Link from 'next/link';
import {AccountSelector} from '@/components/mims/account-selector';
import {accountRequest,csrfToken} from '@/app/accounts/account-client';
import {displayMoney} from '@/app/accounts/account-format';
type Detail={accountNumber:string;holders:{customerId:string;fullName:string}[];mandate:{mandateType:string}|null};
type Receipt={debitTransactionId:string;creditTransactionId:string;sourceBalance:string;destinationBalance:string};
export function TransferScreen(){
 const [source,setSource]=useState(''),[destination,setDestination]=useState(''),[amount,setAmount]=useState(''),[narration,setNarration]=useState('');
 const [destinationName,setDestinationName]=useState(''),[detail,setDetail]=useState<Detail|null>(null),[signers,setSigners]=useState<string[]>([]),[review,setReview]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(''),[receipt,setReceipt]=useState<Receipt|null>(null);
 const key=useRef<string|null>(null);
 useEffect(()=>{setDetail(null);setSigners([]);if(!source)return;const c=new AbortController();
 accountRequest<Detail>(`/api/accounts/${source}`,{signal:c.signal}).then(r=>{if(c.signal.aborted)return;if(r.ok&&r.data)setDetail(r.data);else setError(r.error?.message??'Unable to load source account.');}).catch(()=>{});return()=>c.abort();},[source]);
 async function prepare(){setBusy(true);setError('');try{if(source===destination){setError('Choose different accounts.');return;}if(!/[1-9]/.test(amount)){setError('Enter a positive amount.');return;}if(!signers.length){setError('Check the source holders’ authorization.');return;}
 const r=await accountRequest<Detail>(`/api/accounts/${destination}`);if(!r.ok||!r.data){setError(r.error?.message??'Unable to load destination.');return;}setDestinationName(r.data.accountNumber);key.current=crypto.randomUUID();setReview(true);}finally{setBusy(false);}}
 async function post(){setBusy(true);setError('');try{
 const r=await accountRequest<Receipt>('/api/transactions/transfers',{method:'POST',headers:{'content-type':'application/json','x-csrf-token':csrfToken(),'idempotency-key':key.current??''},body:JSON.stringify({sourceAccountId:source,destinationAccountId:destination,amount,signerCustomerIds:signers,...(narration?{narration}:{})})});
 if(r.ok&&r.data)setReceipt(r.data);else setError(r.error?.message??'Unable to post transfer.');}finally{setBusy(false);}}
 return <div className="space-y-6"><div className="page-header"><div><p className="eyebrow">Staff transactions</p><h1 className="page-title">Transfer between savings accounts</h1><p className="page-description">Both accounts must belong to your branch. Check holder authorization before posting.</p></div></div>
 {error&&<p className="card" role="alert">{error}</p>}{receipt?<section className="card space-y-4" role="status"><h2>Transfer posted</h2><p>Source balance: {displayMoney(receipt.sourceBalance)}</p><p>Destination balance: {displayMoney(receipt.destinationBalance)}</p><Link className="btn btn-primary" href={`/transactions/${receipt.debitTransactionId}`}>View debit receipt</Link><Link className="btn btn-secondary" href={`/transactions/${receipt.creditTransactionId}`}>View credit receipt</Link></section>:
 review?<section className="card confirmation-card space-y-4"><h2>Confirm transfer</h2><p>From {detail?.accountNumber} to {destinationName}</p><p className="amount">{displayMoney(amount)}</p><p>{narration||'No narration'}</p><p>Authorization checked for {signers.length} holder(s).</p><button className="btn btn-secondary" disabled={busy} onClick={()=>{setReview(false);key.current=null;}}>Back to edit</button><button className="btn btn-primary" disabled={busy} onClick={()=>void post()}>{busy?'Posting…':'Confirm transfer'}</button></section>:
 <form className="card space-y-6 max-w-3xl" onSubmit={e=>{e.preventDefault();void prepare();}}><fieldset disabled={busy} className="space-y-5"><fieldset><legend>Source account</legend><AccountSelector value={source} onChange={setSource}/></fieldset><fieldset><legend>Destination account</legend><AccountSelector value={destination} onChange={setDestination}/></fieldset>
 <label className="field">Amount in LKR (required)<input className="input" required pattern="[0-9]{1,13}[.][0-9]{2}" inputMode="decimal" value={amount} onChange={e=>setAmount(e.target.value)}/></label><label className="field">Narration<input className="input" maxLength={255} value={narration} onChange={e=>setNarration(e.target.value)}/></label>
 <fieldset><legend>Source holder authorization</legend>{detail?.holders.map(h=><label className="flex gap-3" key={h.customerId}><input type="checkbox" checked={signers.includes(h.customerId)} onChange={e=>setSigners(ids=>e.target.checked?[...ids,h.customerId]:ids.filter(id=>id!==h.customerId))}/>{h.fullName}</label>)}</fieldset><button className="btn btn-primary" disabled={!source||!destination||!detail}>Review transfer</button></fieldset></form>}</div>;
}
