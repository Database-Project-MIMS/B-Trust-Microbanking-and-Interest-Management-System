"use client";
import { useEffect,useState } from 'react';
import { accountRequest,csrfToken } from '@/app/accounts/account-client';
import { reportMoney } from '@/components/report/report-format';
import { displayDate } from '@/app/accounts/account-format';
import type { InterestRunResult } from '@/services/interest-request-service';
export function InterestConsole({canRun}:{canRun:boolean}){
  const [rows,setRows]=useState<InterestRunResult[]>([]),[date,setDate]=useState(''),[result,setResult]=useState<InterestRunResult|null>(null);
  const [error,setError]=useState(''),[busy,setBusy]=useState(false),[preview,setPreview]=useState<InterestRunResult|null>(null),[loading,setLoading]=useState(true);
  async function history(){
    const response=await accountRequest<InterestRunResult[]>('/api/interest-runs');
    if(response.ok)setRows(response.data ?? []);else setError(response.error?.message ?? 'Unable to load run history.');
    setLoading(false);
  }
  useEffect(()=>{void history();},[]);
  async function run(dryRun:boolean){
    setBusy(true);setError('');
    try{
      const response=await accountRequest<InterestRunResult>('/api/interest-runs',{method:'POST',
        headers:{'content-type':'application/json','x-csrf-token':csrfToken()},body:JSON.stringify({cycleDate:date,dryRun})});
      if(!response.ok || !response.data){setError(response.error?.message ?? 'Unable to process the cycle.');return;}
      if(dryRun)setPreview(response.data);else{setResult(response.data);setPreview(null);await history();}
    }finally{setBusy(false);}
  }
  return <div className="space-y-6"><div className="page-header"><div><p className="eyebrow">Central operations</p>
    <h1 className="page-title">Interest cycles</h1><p className="page-description">Review due distributions and process a controlled interest cycle.</p></div></div>
    {error && <p className="card" role="alert">{error}</p>}
    {canRun && <form className="card form-grid max-w-3xl" onSubmit={event=>{event.preventDefault();void run(true);}}>
      <label className="field">Cycle date (required)<input className="input" type="date" required value={date} disabled={busy}
        onChange={event=>{setDate(event.target.value);setPreview(null);}}/></label>
      <button className="btn btn-primary" disabled={busy}>{busy?'Processing…':'Preview distributions'}</button></form>}
    {preview && <section className="card confirmation-card space-y-4"><h2 className="section-heading">Confirm interest cycle</h2>
      <p>{displayDate(preview.cycleDate)} · {preview.fdCount} due deposits · {reportMoney(preview.totalInterest)} estimated total credit</p>
      <p>Each distribution is checked again and committed independently. Failures are recorded for review.</p>
      <button className="btn btn-primary" disabled={busy} onClick={()=>void run(false)}>{busy?'Processing…':'Confirm and process'}</button></section>}
    {result && <p className="card" role="status">{result.status} · {result.fdCount} distributions · {reportMoney(result.totalInterest)} credited · {result.exceptionCount} exceptions{result.replayed?' · Existing cycle returned':''}</p>}
    <section className="card table-wrap">{loading ? <p role="status">Loading run history…</p> :
      <table className="data-table"><caption className="sr-only">Interest run history</caption><thead><tr>{['Cycle','Status','Distributions','Interest','Exceptions'].map(label=><th scope="col" key={label}>{label}</th>)}</tr></thead>
        <tbody>{rows.length ? rows.map(row=><tr key={row.runId}><th scope="row">{displayDate(row.cycleDate)}</th><td>{row.status}</td><td>{row.fdCount}</td>
          <td className="amount">{reportMoney(row.totalInterest)}</td><td>{row.exceptionCount}</td></tr>) : <tr><td colSpan={5}>No interest cycles recorded.</td></tr>}</tbody></table>}</section>
  </div>;
}
