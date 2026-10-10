'use client';
import {useEffect,useState} from 'react';
import Link from 'next/link';
import {accountRequest,csrfToken} from '@/app/accounts/account-client';
export default function ResetPassword(){
 const [token,setToken]=useState(''),[password,setPassword]=useState(''),[confirm,setConfirm]=useState('');
 const [ready,setReady]=useState(false),[busy,setBusy]=useState(false),[done,setDone]=useState(false),[error,setError]=useState('');
 useEffect(()=>{setToken(new URLSearchParams(window.location.hash.slice(1)).get('token')??'');
  // Remove the bearer capability from the address bar after capturing it in memory.
  window.history.replaceState(null,'',window.location.pathname);
  accountRequest('/api/auth/reset').then(r=>{setReady(r.ok);if(!r.ok)setError(r.error?.message??'Unable to initialize password reset.');});},[]);
 async function submit(){setError('');if(password!==confirm){setError('Passwords do not match.');return;}setBusy(true);
  try{const r=await accountRequest('/api/auth/reset',{method:'POST',headers:{'content-type':'application/json','x-csrf-token':csrfToken()},body:JSON.stringify({token,password})});
   if(r.ok)setDone(true);else setError(r.error?.message??'Unable to reset password.');
  }finally{setBusy(false);}}
 return <main className="mx-auto max-w-xl px-4 py-12 space-y-6"><h1 className="page-title">Reset password</h1>
  {error&&<p className="card" role="alert">{error}</p>}{done?<section className="card" role="status"><p>Password reset. Sign in with your new password.</p><Link className="btn btn-primary" href="/sign-in">Sign in</Link></section>:
  <form className="card space-y-4" onSubmit={e=>{e.preventDefault();void submit();}}>{!token&&<p>Ask your administrator for a reset link.</p>}
   <label className="field">New password (required)<input className="input" autoComplete="new-password" type="password" required minLength={12} maxLength={128} value={password} onChange={e=>setPassword(e.target.value)}/></label>
   <label className="field">Confirm new password (required)<input className="input" type="password" required autoComplete="new-password" value={confirm} onChange={e=>setConfirm(e.target.value)}/></label>
   <button className="btn btn-primary" disabled={!ready||!token||busy}>{busy?'Resetting…':'Reset password'}</button><Link className="btn btn-secondary" href="/sign-in">Back to sign in</Link>
  </form>}</main>;
}
